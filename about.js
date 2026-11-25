const menu=document.querySelector('#mobile-menu');
const menuToggle=document.querySelector('.menu-toggle');
menuToggle.addEventListener('click',()=>{menu.showModal();menuToggle.setAttribute('aria-expanded','true');document.body.style.overflow='hidden'});
document.querySelector('.menu-close').addEventListener('click',()=>menu.close());
menu.addEventListener('close',()=>{menuToggle.setAttribute('aria-expanded','false');document.body.style.overflow='';menuToggle.focus()});
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>menu.close()));
