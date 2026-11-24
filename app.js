const menu=document.querySelector('#mobile-menu');
const menuToggle=document.querySelector('.menu-toggle');
menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');document.body.style.overflow='hidden'});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>{menuToggle.setAttribute('aria-expanded','false');document.body.style.overflow='';menuToggle.focus()});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));
const serviceImage=document.querySelector('.service-image');
document.querySelectorAll('.service-button').forEach((button,index)=>{
 const selectCategory=()=>{
  if(button.getAttribute('aria-pressed')==='true') return;
  document.querySelectorAll('.service-button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  const name=button.dataset.image;
  serviceImage.srcset=`assets/${name}-480.webp 480w, assets/${name}-960.webp 960w, assets/${name}-1600.webp 1600w`;
  serviceImage.src=`assets/${name}-960.webp`;
  serviceImage.alt=button.dataset.alt;
  document.querySelector('.photo-tag').textContent=`0${index+1} / ${button.children[1].textContent.toUpperCase()}`;
 };
 button.addEventListener('pointerenter',event=>{
  if(event.pointerType!=='touch') selectCategory();
 });
 button.addEventListener('focus',selectCategory);
 // A tap still selects a category on devices without hover.
 button.addEventListener('click',selectCategory);
});
const quotes=[['Looking through our wedding photographs feels like living the day all over again.','Ada & Tunde','Wedding · Lagos'],["Opinatii didn't just photograph our event - they captured the feeling in the room.",'The Adeyemi Family','Private Celebration · Abuja'],['Every portrait felt like a page from a magazine. Elegant, honest, timeless.','Chiamaka O.','Studio Portrait · Lagos']];
let quoteIndex=0;
function changeQuote(step){quoteIndex=(quoteIndex+step+quotes.length)%quotes.length;const [quote,name,detail]=quotes[quoteIndex];document.querySelector('blockquote').textContent=`“${quote}”`;const by=document.querySelector('.quote-by');by.textContent=name+' ';const span=document.createElement('span');span.textContent=' / '+detail;by.append(span)}
const testimonial=document.querySelector('.testimonial');
const quoteArea=document.querySelector('.quote-area');
const quoteDelay=6000;
let quoteTimer;
let quoteHovered=false;
function scheduleQuote(){
 clearTimeout(quoteTimer);
 const paused=document.hidden||quoteHovered||testimonial.contains(document.activeElement);
 quoteArea.setAttribute('aria-live',paused?'polite':'off');
 if(!paused) quoteTimer=setTimeout(()=>{changeQuote(1);scheduleQuote()},quoteDelay);
}
testimonial.addEventListener('mouseenter',()=>{quoteHovered=true;scheduleQuote()});
testimonial.addEventListener('mouseleave',()=>{quoteHovered=false;scheduleQuote()});
testimonial.addEventListener('focusin',scheduleQuote);
testimonial.addEventListener('focusout',()=>setTimeout(scheduleQuote,0));
document.addEventListener('visibilitychange',scheduleQuote);
scheduleQuote();
