const activities = [
  ['bath', 'Bath', '/assets/bedtime-stickers/bath.svg'],
  ['pajamas', 'Pajamas', '/assets/bedtime-stickers/pajamas.svg'],
  ['brush', 'Brush teeth', '/assets/bedtime-stickers/brush.svg'],
  ['toilet', 'Toilet', '/assets/bedtime-stickers/toilet.svg'],
  ['book', 'Book', '/assets/bedtime-stickers/book.svg'],
  ['cuddle', 'Cuddle', '/assets/bedtime-stickers/cuddle.svg'],
  ['song', 'Song', '/assets/bedtime-stickers/song.svg'],
  ['white', 'White noise', '/assets/bedtime-stickers/white.svg'],
  ['lights', 'Lights out', '/assets/bedtime-stickers/lights.svg'],
];

const chosen = [];
const picker = document.querySelector('#picker');
const list = document.querySelector('#list');
const activityFor = (id) => activities.find(([activityId]) => activityId === id);

function render() {
  const selected = new Set(chosen);
  picker.innerHTML = activities.map(([id, label, image]) => `
    <button class="sticker ${selected.has(id) ? 'selected' : ''}" data-id="${id}" aria-pressed="${selected.has(id)}">
      <img src="${image}" alt="${label}">
      <em>${label}</em><b aria-hidden="true">✓</b>
    </button>`).join('');

  document.querySelector('#count').textContent = `${chosen.length} of 5 chosen`;
  const complete = chosen.length === 5;
  document.querySelector('#make').disabled = !complete;
  document.querySelector('#next').disabled = !complete;

  list.innerHTML = chosen.length ? chosen.map((id, index) => {
    const [, label, image] = activityFor(id);
    return `<li class="row"><span>${index + 1}</span><img src="${image}" alt=""><strong>${label}</strong>
      <button aria-label="Move ${label} earlier" data-m="-1" data-i="${index}" ${index ? '' : 'disabled'}>↑</button>
      <button aria-label="Move ${label} later" data-m="1" data-i="${index}" ${index === chosen.length - 1 ? 'disabled' : ''}>↓</button></li>`;
  }).join('') : '<li class="empty">Pick five stickers to make a little routine your child can follow.</li>';
}

function showChart() {
  if (chosen.length !== 5) return;
  document.querySelector('#steps').innerHTML = chosen.map((id, index) => {
    const [, label, image] = activityFor(id);
    return `<article class="step"><b>${index + 1}</b><img src="${image}" alt="${label}"><span>${label}</span></article>`;
  }).join('');
  document.querySelector('#builder').hidden = true;
  document.querySelector('#chart').hidden = false;
  window.scrollTo(0, 0);
}

picker.addEventListener('click', (event) => {
  const button = event.target.closest('[data-id]');
  if (!button) return;
  const index = chosen.indexOf(button.dataset.id);
  if (index >= 0) chosen.splice(index, 1);
  else if (chosen.length < 5) chosen.push(button.dataset.id);
  render();
});

list.addEventListener('click', (event) => {
  const button = event.target.closest('[data-m]');
  if (!button) return;
  const index = Number(button.dataset.i);
  const nextIndex = index + Number(button.dataset.m);
  [chosen[index], chosen[nextIndex]] = [chosen[nextIndex], chosen[index]];
  render();
});

document.querySelector('#clear').addEventListener('click', () => { chosen.length = 0; render(); });
document.querySelector('#make').addEventListener('click', showChart);
document.querySelector('#next').addEventListener('click', showChart);
document.querySelector('#edit').addEventListener('click', () => {
  document.querySelector('#chart').hidden = true;
  document.querySelector('#builder').hidden = false;
  window.scrollTo(0, 0);
});
document.querySelector('#print').addEventListener('click', () => window.print());
document.querySelector('#png').addEventListener('click', () => {
  document.querySelector('#png').textContent = 'Use Print / Save as PDF';
  window.setTimeout(() => { document.querySelector('#png').textContent = 'Save as image'; }, 2600);
});

render();