const form = document.querySelector('[data-subscribe-form]');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const success = form.parentElement.querySelector('.success');
    const error = form.parentElement.querySelector('.error');
    success.style.display = 'none'; error.style.display = 'none';
    const button = form.querySelector('button'); const original = button.textContent;
    button.disabled = true; button.textContent = 'Joining…';
    const fd = new FormData(form);
    try {
      const res = await fetch('/api/subscribe', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:fd.get('email'),website:fd.get('website')})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not subscribe.');
      success.textContent = "You're in. Your first note will arrive soon."; success.style.display='block'; form.reset();
    } catch (err) { error.textContent = err.message; error.style.display='block'; }
    finally {button.disabled=false;button.textContent=original;}
  });
}
