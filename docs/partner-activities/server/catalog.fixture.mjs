// Reference fixture only. Production adapter must build this contract from canonical partner catalog.
// Stable keys are namespaced by offer kind; never grant all future children from an approved parent.
const groups={
'الملابس':['clothes','wedding_dress:فساتين زفاف|evening:فساتين سهرة|casual:فساتين يومية|abaya:عبايات|skirt:تنانير|blouse:بلوزات|shirt:قمصان|pants:بناطيل|jeans:جينز|set:أطقم|jacket:جاكيتات ومعاطف|sportswear:ملابس رياضية|loungewear:ملابس منزلية'],
'الشنط':['bags','hand:شنط يد|shoulder:شنط كتف|clutch:كلاتش|crossbody:كروس بودي|backpack:شنط ظهر|tote:توت|travel:شنط سفر|wallet:محافظ'],
'الأحذية':['shoes','heel:كعب|flat:فلات|sandal:صنادل|sneaker:أحذية رياضية|loafer:لوفر|boot:بوت|slipper:سليبر'],
'منتجات الشعر':['hair','shampoo:شامبو|conditioner:بلسم|mask:ماسكات|oil_serum:زيوت وسيرومات|styling:منتجات تصفيف الشعر|dye:صبغات|tools:أجهزة وأدوات الشعر'],
'الوجه والمكياج':['face','makeup_face:مكياج الوجه|makeup_eyes:مكياج العيون|makeup_lips:مكياج الشفاه|makeup_tools:أدوات المكياج|cleanser:منظفات|moisturizer:مرطبات|serum:سيرومات|sunscreen:واقي شمس|mask:ماسكات الوجه'],
'منتجات الجسم':['body','wash:غسول الجسم|moisturizer:مرطبات الجسم|scrub:مقشرات|oil:زيوت|deodorant:مزيلات عرق|hand_care:عناية باليدين|foot_care:عناية بالقدمين'],
'إكسسوارات':['accessories','belt:أحزمة|scarf:أوشحة|sunglasses:نظارات|hat:قبعات|hair:إكسسوارات الشعر'],
'المجوهرات':['jewelry','rings:خواتم|necklaces:قلائد|bracelets:أساور|earrings:أقراط'],
'الأطفال':['children','clothes:ملابس أطفال|shoes:أحذية أطفال|newborn:مستلزمات مواليد'],
'الهدايا':['gifts','boxes:صناديق هدايا'],
'منتجات المناسبات':['occasions','favors:توزيعات|decor:ضيافة للبيع'],
'خدمات المناسبات':['occasions','styling:تنسيق مناسبة'],
'خدمات الصالون والمستقلات':['service','salon_hair_cut:قص وتصفيف الشعر|salon_hair_color:صبغة الشعر|salon_nails:العناية بالأظافر|salon_makeup:ميك أب آرتست|salon_care:عناية عامة|salon.generic:خدمة صالون مخصصة'],
'خدمات العيادة':['service','clinic_skin:عناية بالبشرة|clinic_laser:ليزر|clinic_teeth:أسنان|clinic_consult:استشارة|clinic.generic:خدمة عيادة مخصصة']
};
export function fixtureCatalog(){const m=new Map();for(const [group,[prefix,items]] of Object.entries(groups)){
 for(const pair of items.split('|')){const [key,label]=pair.split(':');const id=prefix+'.'+key;
 m.set(id,{id,label,group,kind:group.startsWith('خدمات')?'service':'product',selectable:true});}}return m}
