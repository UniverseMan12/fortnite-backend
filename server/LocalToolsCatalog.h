#pragma once
namespace LocalTools {
    struct CatalogItem { const char* label; const char* asset; int maxStack; };
    inline constexpr CatalogItem Catalog[] = {
        { "Infinity Gauntlet (experimental)", "AGID_CarminePack", 1 },
        { "Assault rifle - Rare", "WID_Assault_Auto_Athena_R_Ore_T03", 1 },
        { "SCAR - Legendary", "WID_Assault_AutoHigh_Athena_SR_Ore_T03", 1 },
        { "Pump shotgun - Common", "WID_Shotgun_Standard_Athena_C_Ore_T03", 1 },
        { "Bolt-action sniper - Legendary", "WID_Sniper_BoltAction_Scope_Athena_SR_Ore_T03", 1 },
        { "Rocket launcher - Legendary", "WID_Launcher_Rocket_Athena_SR_Ore_T03", 1 },
        { "Mini shields", "Athena_ShieldSmall", 10 },
        { "Shield potions", "Athena_Shields", 2 },
        { "Medkits", "Athena_Medkit", 3 },
        { "Bandages", "Athena_Bandage", 15 }
    };
    inline constexpr int CatalogSize = sizeof(Catalog) / sizeof(Catalog[0]);
    inline constexpr int LootLimit = 100;
}
