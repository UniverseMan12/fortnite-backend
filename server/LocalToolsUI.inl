static inline void LauncherLocalToolsUI()
{
    if (!ImGui::CollapsingHeader("Local tools", ImGuiTreeNodeFlags_DefaultOpen)) return;
    bool respawn = LocalTools::PracticeRespawn.load();
    bool ammo = LocalTools::InfiniteAmmo.load();
    bool materials = LocalTools::InfiniteMaterials.load();
    if (ImGui::Checkbox("Practice respawn (keeps round open)", &respawn)) LocalTools::PracticeRespawn.store(respawn);
    if (ImGui::Checkbox("Infinite ammo (auto-refill)", &ammo)) LocalTools::InfiniteAmmo.store(ammo);
    if (ImGui::Checkbox("Infinite materials (auto-refill)", &materials)) LocalTools::InfiniteMaterials.store(materials);
    if (ImGui::Button("Respawn me")) LocalTools::Queue(LocalTools::Respawn);
    ImGui::SameLine();
    if (ImGui::Button("Heal + shield")) LocalTools::Queue(LocalTools::Heal);
    if (ImGui::Button("Spawn chest loot")) LocalTools::Queue(LocalTools::Loot);
    ImGui::SameLine();
    if (ImGui::Button("Give starter kit")) LocalTools::Queue(LocalTools::Kit);
    if (ImGui::Button("Refill materials")) LocalTools::Queue(LocalTools::Materials);
    ImGui::SameLine();
    if (ImGui::Button("Refill ammo")) LocalTools::Queue(LocalTools::Ammo);
    if (ImGui::Button("Clear player builds")) LocalTools::Queue(LocalTools::ClearBuilds);
    ImGui::TextWrapped("%s", LocalTools::ReadStatus().c_str());
    ImGui::Separator();
}
