/** One 16px art family. No hero_*, SPUM, AI portraits, 3D, or unidentified packs. */
export const CAMPAIGN_ASSETS = {
  town: {
    key: "oath-town",
    url: "/assets/tiles/kenney_tinytown.png",
    frameWidth: 16,
    frameHeight: 16,
  },
  dungeon: {
    key: "oath-dungeon",
    url: "/assets/tiles/kenney_tinydungeon.png",
    frameWidth: 16,
    frameHeight: 16,
  },
} as const;
export const FAMILY_FRAMES = {
  warrior: 84,
  ranger: 85,
  mage: 87,
  thief: 86,
  pirate: 88,
} as const;
export const WORLD_PALETTES = {
  garden: [0x5c8457, 0x739560, 0xe3ca87],
  forest: [0x476b53, 0x59795a, 0xb4c487],
  castle: [0x343b53, 0x424960, 0xcdb27a],
  harbor: [0x39566b, 0x496a77, 0xd4ba89],
  ruin: [0x46445a, 0x555167, 0xbca680],
  astral: [0x333553, 0x414269, 0xcebd88],
  machine: [0x3b4b58, 0x4a5b64, 0xc5ac7b],
  snow: [0x899fa8, 0x9cafb5, 0xd8cba9],
  desert: [0xa98c60, 0xb59a6e, 0xe4c998],
  volcano: [0x59424b, 0x6a4b4b, 0xd9a279],
} as const;
