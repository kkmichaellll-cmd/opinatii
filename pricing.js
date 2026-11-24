const menu=document.querySelector('#mobile-menu');
const menuToggle=document.querySelector('.menu-toggle');
menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');document.body.style.overflow='hidden'});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>{menuToggle.setAttribute('aria-expanded','false');document.body.style.overflow='';menuToggle.focus()});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));

let packageData=null;
let priceError=false;
window.addEventListener('opinatii-prices',({detail})=>{
 priceError=!!detail.error;
 packageData=detail.rows || null;
 renderPackages();
});
const serviceInfo={weddings:['Wedding collections','YOUR DAY, YOUR WAY','One day or two. A lifetime to look back on.'],events:['Event collections','FOR EVERY CELEBRATION','The people, the atmosphere, the moments.'],portraits:['Studio & portrait collections','ENTIRELY YOURSELF','Portraits with personality and feeling.'],editorial:['Editorial collections','A DISTINCT POINT OF VIEW','Photography for your creative vision.']};
let activeService='weddings';let weddingDays='1';
const tabs=[...document.querySelectorAll('[role=tab]')];
function renderPackages(){
 const [title,kicker,copy]=serviceInfo[activeService];
 document.querySelector('#collection-title').textContent=title;
 document.querySelector('#collection-kicker').textContent=kicker;
 document.querySelector('#collection-copy').textContent=copy;
 document.querySelector('.day-toggle').hidden=activeService!=='weddings';
 const packages=(packageData||[]).filter(p=>p.service===activeService && (activeService!=='weddings'||p.days===Number(weddingDays)));
 const grid=document.querySelector('#package-grid');grid.classList.toggle('wedding-packages',activeService==='weddings');grid.replaceChildren();
 const note=document.querySelector('.coverage-note');
 note.textContent=priceError?'Pricing could not be loaded. Please try again shortly.':!packageData?'Loading collections…':!packages.length?'No published packages in this collection.':activeService==='weddings'?`Showing ${weddingDays==='1'?'one-day':'two-day'} wedding collections`:packages.every(p=>!p.price)?'Package details and prices are being finalised.':'';
 packages.forEach((item,i)=>{
  const card=document.createElement('article');card.className='package';
  const heading=document.createElement('h3');heading.textContent=item.name;
  const price=document.createElement('p');price.className='package-price';price.textContent=item.price||'Pricing to be confirmed';
  const detail=document.createElement('p');detail.className='package-detail';detail.textContent=item.description;
  card.append(heading,price,detail);
  if(item.inclusions.length){const list=document.createElement('ul');item.inclusions.forEach(text=>{const li=document.createElement('li');li.textContent=text;list.append(li)});card.append(list)}
  const link=document.createElement('a');link.className='button';link.href='https://wa.me/message/ECYZD4Y5J2BTG1';link.textContent='Enquire about this package';link.setAttribute('aria-label',`Enquire about ${title.toLowerCase()} ${item.name}${activeService==='weddings'?`, ${weddingDays} day coverage`:''}`);card.insertBefore(link,card.querySelector('ul'));grid.append(card);
 });
}
function selectService(tab){activeService=tab.dataset.service;tabs.forEach(t=>{t.setAttribute('aria-selected',String(t===tab));t.tabIndex=t===tab?0:-1});document.querySelector('#collection-panel').setAttribute('aria-labelledby',tab.id);renderPackages()}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectService(tab));tab.addEventListener('keydown',e=>{let index;if(e.key==='ArrowRight')index=(i+1)%tabs.length;else if(e.key==='ArrowLeft')index=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=tabs.length-1;else return;e.preventDefault();tabs[index].focus();selectService(tabs[index])})});
document.querySelectorAll('[name=wedding-days]').forEach(input=>input.addEventListener('change',()=>{weddingDays=input.value;renderPackages()}));
renderPackages();
