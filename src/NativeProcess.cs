using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

// Owns only processes launched by this helper. Closing the helper closes this job.
public sealed class LocalGameSession : IDisposable
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct StartupInfo { public int cb; public string reserved, desktop, title; public int x,y,xSize,ySize,xChars,yChars,fill,flags; public short show,reserved2; public IntPtr reservedPtr,input,output,error; }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process, thread; public int pid, tid; }
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits { public long processTime, jobTime; public uint flags; public UIntPtr minWorkingSet,maxWorkingSet; public uint activeProcesses; public UIntPtr affinity; public uint priority,scheduling; }
    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters { public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes; }
    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits { public BasicLimits basic; public IoCounters io; public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app, StringBuilder command, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string cwd, ref StartupInfo startup, out ProcessInfo info);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits info, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool TerminateProcess(IntPtr process, uint code);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint rights, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr VirtualAllocEx(IntPtr process, IntPtr address, UIntPtr size, uint type, uint protection);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool VirtualFreeEx(IntPtr process, IntPtr address, UIntPtr size, uint type);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool WriteProcessMemory(IntPtr process, IntPtr address, byte[] buffer, UIntPtr size, out UIntPtr written);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("kernel32.dll", CharSet=CharSet.Ansi, ExactSpelling=true, SetLastError=true)] static extern IntPtr GetProcAddress(IntPtr module, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateRemoteThread(IntPtr process, IntPtr attributes, UIntPtr stack, IntPtr start, IntPtr parameter, uint flags, IntPtr tid);
    [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetExitCodeThread(IntPtr thread, out uint code);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    IntPtr job;
    static Exception Error(string operation) { return new Win32Exception(Marshal.GetLastWin32Error(), operation); }
    public LocalGameSession() {
        if (IntPtr.Size != 8) throw new InvalidOperationException("64-bit PowerShell is required.");
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw Error("CreateJobObject");
        var limits = new ExtendedLimits(); limits.basic.flags = 0x2000; // KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits))) { var e=Error("SetInformationJobObject"); Dispose(); throw e; }
    }
    public int Start(string executable, string arguments, bool leaveSuspended, string workingDirectory) {
        var startup = new StartupInfo(); startup.cb = Marshal.SizeOf(startup);
        ProcessInfo info;
        var command = new StringBuilder("\"" + executable + "\" " + arguments);
        if (!CreateProcess(executable, command, IntPtr.Zero, IntPtr.Zero, false, 4, IntPtr.Zero, workingDirectory, ref startup, out info)) throw Error("CreateProcess");
        try {
            if (!AssignProcessToJobObject(job, info.process)) { TerminateProcess(info.process,1); throw Error("AssignProcessToJobObject"); }
            if (!leaveSuspended && ResumeThread(info.thread) == 0xffffffff) { TerminateProcess(info.process,1); throw Error("ResumeThread"); }
            return info.pid;
        } finally { CloseHandle(info.thread); CloseHandle(info.process); }
    }
    public void LoadLibrary(int pid, string file) {
        if (!File.Exists(file)) throw new FileNotFoundException(file);
        IntPtr process = OpenProcess(0x43a, false, pid);
        if (process == IntPtr.Zero) throw Error("OpenProcess");
        IntPtr buffer = IntPtr.Zero, thread = IntPtr.Zero;
        bool finished = true;
        try {
            byte[] bytes = Encoding.Unicode.GetBytes(Path.GetFullPath(file) + "\0");
            buffer = VirtualAllocEx(process, IntPtr.Zero, (UIntPtr)bytes.Length, 0x3000, 4);
            if (buffer == IntPtr.Zero) throw Error("VirtualAllocEx");
            UIntPtr written;
            if (!WriteProcessMemory(process, buffer, bytes, (UIntPtr)bytes.Length, out written) || written.ToUInt64() != (ulong)bytes.Length) throw Error("WriteProcessMemory");
            IntPtr loader = GetProcAddress(GetModuleHandle("kernel32.dll"), "LoadLibraryW");
            if (loader == IntPtr.Zero) throw Error("LoadLibraryW address");
            thread = CreateRemoteThread(process, IntPtr.Zero, UIntPtr.Zero, loader, buffer, 0, IntPtr.Zero);
            if (thread == IntPtr.Zero) throw Error("CreateRemoteThread");
            finished = WaitForSingleObject(thread, 15000) == 0;
            if (!finished) throw new TimeoutException("DLL did not load within 15 seconds: " + file);
            uint code;
            if (!GetExitCodeThread(thread, out code) || code == 0) throw new InvalidOperationException("Could not load DLL: " + file);
        } finally {
            if (thread != IntPtr.Zero) CloseHandle(thread);
            // On timeout, the job owner terminates the process; don't free a buffer still in use.
            if (buffer != IntPtr.Zero && finished) VirtualFreeEx(process, buffer, UIntPtr.Zero, 0x8000);
            CloseHandle(process);
        }
    }
    public void Dispose() { if (job != IntPtr.Zero) { CloseHandle(job); job=IntPtr.Zero; } }
}
