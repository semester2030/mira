const root=document.querySelector('#app'),msg=document.querySelector('#msg');
const e=(tag,txt,attrs={})=>{const n=document.createElement(tag);if(txt!=null)n.textContent=txt;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
function tell(t,bad=false){msg.textContent=t;msg.className=bad?'error':'ok';if(t)msg.scrollIntoView({block:'nearest'})}
const errors={VERIFICATION_REQUIRED:'سجّلي كيف تحققتِ من صفة الشريك والأنشطة التي ستعتمدينها.',INVALID_CONTACT:'راجعي بيانات التواصل وكلمة المرور (١٠ أحرف على الأقل).',INVALID_APPLICATION:'أضيفي نشاطًا واحدًا على الأقل واكتبي وصف نشاطك.',INVALID_SCOPE:'حددي نطاق النشاط.',INVALID_OPTIONS:'حددي صفة المنشأة أو المقدّمة.',SERVICE_LOCATION_REQUIRED:'حددي مكان تقديم الخدمة.',INVALID_SINGLE_ITEM:'أدخلي اسم المنتج المفرد.',INVALID_TARGET:'تأكدي من اسم العرض وتصنيفه.',ACTIVITY_NOT_APPROVED:'هذا العرض خارج الأنشطة المعتمدة لحسابك.',EXPANSION_PENDING:'لديك طلب توسيع قيد المراجعة.',ALREADY_GRANTED:'أحد الأنشطة معتمد مسبقًا.',REASON_REQUIRED:'أضيفي سبب رفض البنود غير المعتمدة.',LOGIN_FAILED:'تعذّر الدخول. تحققي من البيانات واعتماد الحساب.',ACCOUNT_EXISTS:'تعذّر إنشاء طلب جديد لهذا البريد. إن سبق التقديم فراجعي حالة طلبك مع الإدارة.',ALREADY_REVIEWED:'تمت مراجعة هذا الطلب مسبقًا.',INVALID_FIELDS:'تحتوي البيانات على حقول غير معتمدة.'};
async function api(path,data){let r=await fetch('/api/'+path,{method:data?'POST':'GET',headers:data?{'content-type':'application/json'}:{},body:data?JSON.stringify(data):undefined});let v=await r.json();if(!r.ok)throw Error(errors[v.error]??'تعذّرت العملية. راجعي البيانات والصلاحية وحاولي مجددًا.');return v}
function handle(fn){return async ev=>{ev?.preventDefault();try{await fn()}catch(err){tell(err.message,true)}}}
function field(box,label,type='text',initial='',required=true){const l=e('label',label,{class:'field'}),i=e('input',null,{type});i.value=initial;i.required=required;l.append(i);box.append(l);return i}
function check(box,label,value,on=false){const l=e('label'),i=e('input',null,{type:'checkbox'});i.value=value;i.checked=on;l.append(i,' '+label);box.append(l);return i}
function sel(box,items){const s=e('select');for(const [key,label] of items)s.append(e('option',label,{value:key}));box.append(s);return s}
function button(box,text,fn){const b=e('button',text,{type:'button'});b.onclick=handle(fn);box.append(b);return b}
function listbox(box,title,options,initial=[]){const f=e('fieldset'),os=e('div',null,{class:'opts'});box.append(f);f.append(e('legend',title),os);const inputs=Object.entries(options).map(([k,v])=>check(os,v,k,initial.includes(k)));return ()=>inputs.filter(i=>i.checked).map(i=>i.value)}
const stateName={pending:'قيد المراجعة',approved:'معتمد',rejected:'مرفوض',partial:'معتمد جزئيًا'};
let data,me;let defs;
function editor(parent,isExpand){
 const form=e('form'),grid=e('div',null,{class:'grid'});parent.append(form);
 form.append(e('h1',isExpand?'طلب توسيع النشاط':'طلب انضمام إلى ميرا'),e('p',isExpand?'تبقى أنشطتك المعتمدة متاحة أثناء مراجعة الطلب.':'حددي من أنتِ، ثم اختاري المنتجات أو الخدمات التي تقدمينها. ستراجِع الإدارة كل نشاط قبل تفعيله.'),grid);
 let contact={}; if(!isExpand){for(const [key,label,type,req] of [['name','اسم المتجر أو اسم المقدّمة','text',true],['nameEn','الاسم بالإنجليزية (اختياري)','text',false],['commercialRegistration','السجل التجاري (اختياري)','text',false],['vatNumber','الرقم الضريبي (اختياري)','text',false],['contactName','اسم المسؤول','text',true],['email','البريد الإلكتروني','email',true],['phone','رقم الجوال','tel',true],['city','المدينة','text',true],['password','كلمة المرور','password',true],['evidence','رابط متجر أو حساب أعمال (اختياري)','url',false]])contact[key]=field(grid,label,type,'',req);contact.password.minLength=10}
 const previous=me?.profile?.requests.find(x=>['approved','partial'].includes(x.state))?.meta??{};
 const idents=listbox(form,'صفة النشاط (يمكن الجمع)',data.identityKinds,previous.identity),locations=listbox(form,'أين تقدمين الخدمة؟',data.modes,previous.locations);
 const desc=field(form,isExpand?'صفي النشاط الذي تريدين إضافته':'ما المنتجات أو الخدمات التي تقدمينها؟');
 form.append(e('h2','الأنشطة المطلوبة'),e('p','اختاري منتجًا محددًا بالاسم، أو اختاري تصنيفات كاملة. اختيار مجموعة يضم فروعها الحالية فقط.'));
 const byGroup=data.items.reduce((g,x)=>{(g[x.group]??=[]).push(x);return g},{}),rows=[];
 for(const [group,items] of Object.entries(byGroup)){
  const box=e('details');form.append(box);box.append(e('summary',group));const tools=e('div',null,{class:'actions'});box.append(tools);
  const inputs=[];button(tools,'اختيار فروع المجموعة',()=>{for(const r of inputs)if(!r.cb.disabled){r.cb.checked=true;r.render()}}).className='sub';
  button(tools,'إلغاء المجموعة',()=>{for(const r of inputs){r.cb.checked=false;r.render()}}).className='sub';
  for(const it of items){const row=e('div',null,{class:'line'});box.append(row);const cb=check(row,it.label,it.id);const scope=sel(row,it.kind==='product'?[['category','هذا التصنيف'],['one','منتج واحد محدد']]:[['category','هذه الخدمة']]);scope.setAttribute('aria-label','نطاق '+it.label);
   const name=e('textarea',null,{rows:'2',placeholder:'اسم منتج واحد، أو عدة أسماء: منتج في كل سطر','aria-label':'أسماء المنتجات المعتمدة بالاسم'});row.append(name);
   if(isExpand&&me?.profile?.grants.some(g=>g.activity===it.id&&g.scope==='category')){cb.disabled=true;cb.parentNode.append(' · معتمد')}
   const render=()=>{scope.hidden=!cb.checked;name.hidden=!(cb.checked&&scope.value==='one');name.required=!name.hidden};
   cb.onchange=scope.onchange=render;render();inputs.push({cb,render});rows.push({it,cb,scope,name});
  }
 }
 form.append(e('button',isExpand?'إرسال طلب الإضافة':'إرسال طلب الانضمام',{type:'submit'}));
 form.onsubmit=handle(async()=>{const request={identity:idents(),locations:locations(),description:desc.value,lines:rows.filter(r=>r.cb.checked).flatMap(r=>r.scope.value==='one'?r.name.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(itemName=>({activity:r.it.id,scope:'one',itemName})):[{activity:r.it.id,scope:'category'}])};
 let payload=isExpand?request:{contact:Object.fromEntries(Object.entries(contact).map(([k,v])=>[k,v.value])),request};
 const res=await api(isExpand?'expand':'apply',payload);await load();tell('تم إرسال الطلب وهو قيد المراجعة. الرقم: '+res.requestId)});
}
function login(){const f=e('form');root.append(f);f.append(e('h2','دخول الحساب'));const mail=field(f,'البريد الإلكتروني','email'),pw=field(f,'كلمة المرور','password');f.append(e('button','دخول',{type:'submit'}));f.onsubmit=handle(async()=>{await api('login',{email:mail.value,password:pw.value});await load();tell('تم تسجيل الدخول.')})}
function history(parent,x){const a=e('article');parent.append(a);a.append(e('b',(x.kind==='join'?'انضمام':'توسعة')+' · '+stateName[x.state]),e('p',x.description));for(const l of x.lines)a.append(e('p',(defs.get(l.activity)?.label??l.activity)+(l.item_name?' · '+l.item_name:'')+' — '+stateName[l.decision]));if(x.reason)a.append(e('p','سبب القرار: '+x.reason))}
async function items(actor,profile){const box=e('form');root.append(box);box.append(e('h2','إضافة عرض ضمن صلاحيات الحساب'));const all=actor.role==='developer'?data.items:data.items.filter(x=>profile.grants.some(g=>g.activity===x.id));
 if(!all.length){box.append(e('p','لا توجد أنشطة معتمدة بعد.'));return}
 let editing=null;const selection=sel(box,all.map(i=>[i.id,i.group+' · '+i.label])),title=field(box,'اسم العرض'),state=sel(box,[['draft','حفظ مسودة'],['published','نشر العرض']]);const refresh=()=>{const names=(profile?.grants??[]).filter(g=>g.activity===selection.value);const one=names.find(g=>g.scope==='one');if(one&&!names.some(g=>g.scope==='category'))title.value=one.item_name;else title.value=''};selection.onchange=refresh;refresh();box.append(e('button','حفظ',{type:'submit'}));
 const list=e('section');root.append(list);list.append(e('h2','عروضي'));for(const obj of await api('items')){const row=e('p');list.append(row);row.append(e('span',obj.title+' · '+(obj.state==='draft'?'مسودة':'منشور')+' '));button(row,'فتح وتعديل',()=>{editing=obj.id;selection.value=obj.activity;title.value=obj.title;state.value=obj.state;title.focus()}).className='sub'}
 box.onsubmit=handle(async()=>{const it=defs.get(selection.value);const saved=await api('item',{id:editing,activity:it.id,kind:it.kind,title:title.value,publish:state.value==='published'});await load();tell('تم حفظ العرض: '+saved.id)})}
async function load(){
 data=await api('catalog');defs=new Map(data.items.map(x=>[x.id,x]));me=await api('me');root.replaceChildren();const a=me.actor,path=location.pathname;
 if(a){const top=e('div',null,{class:'actions'});root.append(top);top.append(e('b',a.display));button(top,'تسجيل الخروج',async()=>{await api('logout',{});await load()}).className='sub'}
 if(path==='/'||path==='/apply.html'){editor(root,false);return}if(path==='/status'){const f=e('form');root.append(f);f.append(e('h1','متابعة طلب الانضمام'));const em=field(f,'البريد الإلكتروني','email'),pw=field(f,'كلمة المرور','password');f.append(e('button','عرض حالة الطلب',{type:'submit'}));const result=e('section');root.append(result);f.onsubmit=handle(async()=>{const r=await api('status',{email:em.value,password:pw.value});result.replaceChildren();result.append(e('h2',stateName[r.state]));for(const l of r.lines)result.append(e('p',(defs.get(l.activity)?.label??l.activity)+' · '+stateName[l.decision]));if(r.reason)result.append(e('p',r.reason));});return}if(!a){login();return}
 if(path==='/review'){
  if(a.role!=='admin'){root.append(e('p','مراجعة طلبات الشركاء متاحة للإدارة فقط.'));return}
  root.append(e('h1','طلبات الشركاء'));const pending=await api('review');if(!pending.length)root.append(e('p','لا توجد طلبات جديدة.'));
  for(const r of pending){const card=e('section');root.append(card);const b=r.business??{};card.append(e('h2',(r.kind==='join'?'انضمام: ':'توسعة: ')+(b.name??r.id)),e('p',[b.contactName,b.email,b.phone,b.city,b.evidence,b.commercialRegistration,b.vatNumber].filter(Boolean).join(' · ')),e('p',r.meta.identity.map(k=>data.identityKinds[k]).join('، ')+' · '+r.meta.locations.map(k=>data.modes[k]).join('، ')),e('p',r.description),e('p','حددي البنود المعتمدة؛ تُرفض البنود غير المحددة.'));let cbs=[];
   for(const l of r.lines){let p=e('p');card.append(p);cbs.push(check(p,(defs.get(l.activity)?.label??l.activity)+' · '+(l.item_name||'التصنيف'),l.id))}
   const verification=field(card,'كيف تحققتِ من صفة الشريك وهذه الأنشطة؟ (مطلوب للاعتماد)','text','',false);const why=field(card,'سبب القرار (مطلوب عند رفض أي بند)','text','',false);
   button(card,'تسجيل القرار',async()=>{await api('decide',{requestId:r.id,decision:{approvedLineIds:cbs.filter(c=>c.checked).map(c=>c.value),reason:why.value,verificationNote:verification.value}});await load();tell('تم تسجيل القرار وتحديث الصلاحيات.')})
  }return}
 if(a.role==='admin'){root.append(e('a','فتح مراجعة الطلبات',{href:'/review'}));return}
 if(a.role==='developer'){root.append(e('p','حساب المطور: جميع تصنيفات المنتجات والخدمات متاحة.'));await items(a,null);return}
 const pf=me.profile,gr=e('section');root.append(gr);gr.append(e('h1','أنشطتي المعتمدة'));for(const g of pf.grants)gr.append(e('p',(defs.get(g.activity)?.label??g.activity)+(g.item_name?' · '+g.item_name:'')));
 await items(a,pf);const past=e('section');root.append(past);past.append(e('h2','طلباتي وقرارات الإدارة'));for(const r of pf.requests)history(past,r);
 if(!pf.requests.some(r=>r.kind==='expand'&&r.state==='pending'))editor(root,true);
}
load().catch(e=>tell(e.message,true));
