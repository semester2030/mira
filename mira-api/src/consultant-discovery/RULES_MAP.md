# R001–R081 execution map

| Rule | liveSource | targets | Code path | Tested | Gap |
|---|---|---|---|---|---|
| R001 | clothes.wedding_dress | bags.clutch, jewelry.earrings | intent+browse | intent/study |  |
| R002 | clothes.wedding_dress | occasions.styling | intent+browse | intent/study |  |
| R003 | clothes.wedding_dress | beauty.makeup, beauty.hair.cut | registry only | pending signal |  |
| R004 | clothes.abaya | accessories.scarf, bags.shoulder | registry only | pending signal |  |
| R005 | clothes.evening | bags.clutch, shoes.flat | intent+browse | intent/study |  |
| R006 | clothes.casual | shoes.sneaker, bags.crossbody | registry only | pending signal |  |
| R007 | clothes.skirt | clothes.blouse | registry only | pending signal |  |
| R008 | clothes.blouse | clothes.skirt, clothes.pants | registry only | pending signal |  |
| R009 | clothes.shirt | clothes.pants, shoes.loafer | registry only | pending signal |  |
| R010 | clothes.pants | clothes.shirt, accessories.belt | registry only | pending signal |  |
| R011 | clothes.jeans | shoes.sneaker, clothes.blouse | registry only | pending signal |  |
| R012 | clothes.set | bags.hand, shoes.flat | registry only | pending signal |  |
| R013 | clothes.jacket | accessories.scarf, shoes.boot | registry only | pending signal |  |
| R014 | clothes.sportswear | shoes.sneaker | registry only | pending signal |  |
| R015 | clothes.loungewear | shoes.slipper | registry only | pending signal |  |
| R016 | bags.hand | bags.wallet | intent+browse | intent/study |  |
| R017 | bags.shoulder | bags.crossbody | registry only | pending signal |  |
| R018 | bags.clutch | jewelry.earrings | registry only | pending signal |  |
| R019 | bags.crossbody | shoes.sneaker, shoes.flat | registry only | pending signal |  |
| R020 | bags.backpack | bags.tote | registry only | pending signal |  |
| R021 | bags.tote | bags.wallet | registry only | pending signal |  |
| R022 | bags.travel | bags.backpack, bags.crossbody | registry only | pending signal |  |
| R023 | bags.wallet | gifts.boxes | registry only | pending signal |  |
| R024 | shoes.heel | shoes.flat | registry only | pending signal |  |
| R025 | shoes.flat | bags.hand | registry only | pending signal |  |
| R026 | shoes.sandal | clothes.casual | registry only | pending signal |  |
| R027 | shoes.sneaker | clothes.sportswear | registry only | pending signal |  |
| R028 | shoes.loafer | clothes.pants | registry only | pending signal |  |
| R029 | shoes.boot | clothes.jacket | registry only | pending signal |  |
| R030 | shoes.slipper | clothes.loungewear | registry only | pending signal |  |
| R031 | face.makeup_face | face.makeup_tools | intent+browse | intent/study |  |
| R032 | face.makeup_eyes | face.makeup_tools | registry only | pending signal |  |
| R033 | face.makeup_lips | face.makeup_face | registry only | pending signal |  |
| R034 | face.cleanser | face.moisturizer | registry only | pending signal |  |
| R035 | face.moisturizer | face.cleanser | intent+browse | intent/study |  |
| R036 | face.serum |  | registry only | pending signal |  |
| R037 | face.sunscreen |  | registry only | pending signal |  |
| R038 | face.mask |  | registry only | pending signal |  |
| R039 | face.makeup_tools | face.makeup_eyes, face.makeup_face | registry only | pending signal |  |
| R040 | body.wash | body.moisturizer | registry only | pending signal |  |
| R041 | body.moisturizer | body.wash | registry only | pending signal |  |
| R042 | body.scrub |  | registry only | pending signal |  |
| R043 | body.oil | body.moisturizer | registry only | pending signal |  |
| R044 | body.deodorant |  | registry only | pending signal |  |
| R045 | body.hand_care | beauty.nails | registry only | pending signal |  |
| R046 | body.foot_care |  | registry only | pending signal |  |
| R047 | hair.shampoo | hair.conditioner | registry only | pending signal |  |
| R048 | hair.conditioner | hair.shampoo | registry only | pending signal |  |
| R049 | hair.mask |  | registry only | pending signal |  |
| R050 | hair.oil_serum | hair.styling | registry only | pending signal |  |
| R051 | hair.styling | hair.tools | registry only | pending signal |  |
| R052 | hair.dye | beauty.hair.color | registry only | pending signal |  |
| R053 | hair.tools | hair.styling | registry only | pending signal |  |
| R054 | accessories.belt | clothes.pants | registry only | pending signal |  |
| R055 | accessories.scarf | clothes.abaya | registry only | pending signal |  |
| R056 | accessories.sunglasses | accessories.hat | registry only | pending signal |  |
| R057 | accessories.hat | accessories.sunglasses | registry only | pending signal |  |
| R058 | accessories.hair | beauty.hair.cut | registry only | pending signal |  |
| R059 | jewelry.rings | jewelry.bracelets | intent+browse | intent/study |  |
| R060 | jewelry.necklaces | jewelry.earrings | registry only | pending signal |  |
| R061 | jewelry.bracelets | gifts.boxes, jewelry.rings | registry only | pending signal |  |
| R062 | jewelry.earrings | jewelry.necklaces | registry only | pending signal |  |
| R063 | children.clothes | children.shoes | registry only | pending signal |  |
| R064 | children.shoes | children.clothes | registry only | pending signal |  |
| R065 | children.newborn | gifts.boxes | intent+browse | intent/study |  |
| R066 | children.newborn | occasions.favors | registry only | pending signal |  |
| R067 | gifts.boxes | jewelry.bracelets, children.newborn | intent+browse | intent/study |  |
| R068 | occasions.favors | occasions.decor | intent+browse | intent/study |  |
| R069 | occasions.decor | occasions.styling | intent+browse | intent/study |  |
| R070 | occasions.styling | occasions.favors, occasions.decor | intent+browse | intent/study |  |
| R071 | beauty.hair.cut | accessories.hair, beauty.makeup | registry only | pending signal |  |
| R072 | beauty.hair.color |  | registry only | pending signal |  |
| R073 | beauty.nails | body.hand_care | registry only | pending signal |  |
| R074 | beauty.makeup | beauty.hair.cut | intent+browse | intent/study |  |
| R075 | beauty.face_care |  | registry only | pending signal |  |
| R076 | beauty.clinic_derm |  | registry only | pending signal |  |
| R077 | beauty.clinic_laser |  | intent+browse | intent/study |  |
| R078 | beauty.clinic_derm |  | registry only | pending signal |  |
| R079 | beauty.clinic_teeth |  | registry only | pending signal |  |
| R080 | beauty.salons |  | registry only | pending signal |  |
| R081 | beauty.clinics |  | registry only | pending signal |  |

Wired in decideIntent for first journeys + gates; remaining rows inherit via enrichFromRulesRegistry when a signal path sets ruleIds.