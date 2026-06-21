// Pagination loader: renders page links (1..10) into elements with `data-pagination`.
// Links point to `pages/pageN.html` when on the site root, or `pageN.html` when already inside `/pages/`.
document.querySelectorAll('[data-pagination]').forEach((el) => {
  const inPagesDir = location.pathname.includes('/pages/');
  const base = inPagesDir ? '' : 'pages/';
  const ul = document.createElement('ul');
  ul.style.listStyle = 'none';
  ul.style.padding = '0';
  ul.style.margin = '0';
  ul.style.display = 'flex';
  ul.style.gap = '6px';

  for (let i = 1; i <= 10; i++) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = base + 'page' + i + '.html';
    a.textContent = String(i);
    a.style.display = 'inline-block';
    a.style.padding = '6px 10px';
    a.style.border = '1px solid #ccc';
    a.style.borderRadius = '4px';
    a.style.textDecoration = 'none';
    a.style.color = '#000';

    // Highlight current page if URL matches
    const pathname = location.pathname.replace(/\\/g, '/');
    if (pathname.endsWith('/' + base + 'page' + i + '.html') || pathname.endsWith('/page' + i + '.html')) {
      a.style.background = '#eee';
    }

    li.appendChild(a);
    ul.appendChild(li);
  }

  el.appendChild(ul);
});
