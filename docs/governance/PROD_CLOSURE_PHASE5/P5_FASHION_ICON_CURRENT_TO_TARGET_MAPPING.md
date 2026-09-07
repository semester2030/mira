# Current Fashion Icons → Target Mapping

**Task:** MIRA-P5-FASHION-ICON-SYSTEM-STUDY-2026-09-07  
**STUDY ONLY**

| CURRENT ICON | CURRENT MEANING (typical) | PROBLEM | TARGET CATEGORY | TARGET ICON ID | TARGET SOURCE | ACTION |
|--------------|---------------------------|---------|-----------------|----------------|---------------|--------|
| Icons.checkroom_outlined / rounded | garment / wardrobe / empty | Overused generic | Fashion / Intelligence | dress… OR wardrobe | PHOSPHOR/CUSTOM per type | REPLACE |
| Icons.auto_awesome_* | AI / elegant / Mira | Sparkle collision | Intelligence / Style | recommendations / elegant / ask_mira | split | REPLACE |
| Icons.air_rounded | scarf | SEMANTICALLY_WRONG | Fashion | scarf | CUSTOM | REPLACE |
| Icons.shopping_bag_outlined | bag | Retail ≠ handbag | Fashion | handbag | PHOSPHOR | REPLACE |
| Icons.directions_walk_rounded | shoes/walk | Wrong | Fashion | shoe_heel | PHOSPHOR | REPLACE |
| Icons.diamond_outlined | elegant/jewelry/formal | Collision | Fashion | jewelry OR elegant | CUSTOM | REPLACE |
| Icons.linear_scale_rounded | belt | Wrong | Fashion | belt | PHOSPHOR | REPLACE |
| Icons.favorite_* | wedding / wishlist | Heart≠occasion; wishlist is system | Occasion OR System | special_occasion OR favorite | CUSTOM / SYSTEM | REMAP |
| Icons.celebration_outlined | special | Weak party | Fashion | special_occasion | CUSTOM | REPLACE |
| Icons.weekend_outlined | casual/everyday | Sofa metaphor | Fashion | everyday / casual | PHOSPHOR | REPLACE |
| Icons.work_outline_rounded | work | Material | Fashion | work | PHOSPHOR | REPLACE |
| Icons.nightlife_outlined | evening | Material | Fashion | evening | PHOSPHOR | REPLACE |
| Icons.school_outlined | formal-ish | Wrong | Fashion | formal | CUSTOM | REPLACE |
| Icons.palette_* | color | OK concept | Fashion | color_palette / color_harmony | PHOSPHOR | REPLACE |
| Icons.style_outlined | Ask Mira / styling | Chat-adjacent | Fashion | ask_mira / outfit_styling | CUSTOM / PHOSPHOR | REPLACE |
| Icons.flash_on_rounded | quick mode | System/feature | System or Style | casual OR system bolt | PHOSPHOR | REMAP |
| Icons.brush_rounded | recolor | Tool | System | paint-brush (system) | PHOSPHOR | REMAP |
| Icons.face_retouching_* | makeup / skin link | Adjacent | System / Skin | keep Skin domain icons later | SYSTEM | REMAP |
| Icons.woman_rounded | silhouette | Body glyph risk | Fashion | silhouette_cut | CUSTOM | REPLACE |
| Icons.straighten / line_style | cut/fabric | Weak | Fashion | fabric / silhouette_cut | CUSTOM | REPLACE |
| Icons.event_* | occasion | Calendar | Fashion / System | everyday OR system calendar | mix | REMAP |
| Icons.swipe_* | interaction hint | System gesture | System | SYSTEM | PHOSPHOR | REMAP |
| Icons.arrow_* / chevron_* | navigation | System | System | back/forward | PHOSPHOR + RTL mirror | REMAP |
| Icons.refresh_rounded | retry | System | System | refresh | PHOSPHOR | REMAP |
| Icons.photo_* / cameraswitch / circle | capture | System | System | camera/gallery/shutter | PHOSPHOR | REMAP |
| Icons.check_* / close / info / error / cloud_off / lock / verified / visibility / link / compare / add_a_photo / touch_app / image_not_supported / shield / keyboard_arrow_up / chat_bubble | system chrome | Outside 36 | System | MiraSystemIcon.* | PHOSPHOR | REMAP |
| Icons.watch_outlined | jewelry/watch | Narrow | Fashion accessory detail | jewelry (or system watch) | CUSTOM | REPLACE |
| Icons.record_voice_over | occasion speech | Weak | Occasion map | remap per occasion | — | REPLACE |

Full per-usage machine inventory: `CURRENT_FASHION_ICON_INVENTORY.json` (114 rows; `replacementTarget` filled in study pass).
