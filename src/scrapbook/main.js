/********************************************************************
 *
 * Script for main.html
 *
 * @require {Object} scrapbook
 *******************************************************************/

const scrapbookUi = {
  lastHighlightElem: null,
  bookId: null,
  book: null,

  log(msg) {
    document.getElementById("logger").appendChild(document.createTextNode(msg + '\n'));
  },

  warn(msg) {
    const span = document.createElement('span');
    span.className = 'warn';
    span.appendChild(document.createTextNode(msg + '\n'));
    document.getElementById("logger").appendChild(span);
  },

  error(msg) {
    const span = document.createElement('span');
    span.className = 'error';
    span.appendChild(document.createTextNode(msg + '\n'));
    document.getElementById("logger").appendChild(span);
  },

  enableToolbar(willEnable) {
    document.getElementById('toolbar').querySelector('fieldset').disabled = !willEnable;
  },

  /**
   * @param {HTMLElement} elem - the element to be inserted to the dialog.
   *     A 'resolve' attribute will be bind to elem, which can be call to close the dialog.
   */
  async showDialog(elem) {
    const mask = document.getElementById('dialog-mask');
    const wrapper = document.getElementById('dialog-wrapper');
    wrapper.innerHTML = '';
    wrapper.appendChild(elem);

    const onClick = (event) => {
      if (event.target === mask) {
        elem.resolve();
      }
    };

    mask.addEventListener('click', onClick);
    mask.hidden = false;

    const result = await new Promise((resolve, reject) => {
      elem.resolve = resolve;
    });

    mask.removeEventListener('click', onClick);
    mask.hidden = true;

    return result;
  },
  
  async init() {
    // UI reset
    document.getElementById("logger").innerHTML = "";
    document.getElementById('item-root').innerHTML = "";

    // load config
    await scrapbook.loadOptions();

    if (!scrapbook.hasServer()) {
      this.log(`Backend server is not configured.`);
      return;
    }

    // load server config
    try {
      await server.init();
    } catch (ex) {
      console.error(ex);
      this.error(`Backend initilization error: ${ex.message}`);
      return;
    }

    // load scrapbooks
    try {
      const bookId = this.bookId = new URL(location.href).searchParams.get('id') || '';
      const book = this.book = server.books[bookId];

      // init book select
      const wrapper = document.getElementById('book');
      for (const [bookId, book] of Object.entries(server.books)) {
        const opt = document.createElement('option');
        opt.value = bookId;
        opt.textContent = book.name;
        wrapper.appendChild(opt);
      }
      wrapper.value = bookId;
      wrapper.hidden = false;
    } catch (ex) {
      this.error(`Unable to load scrapbooks: ${ex.message}`);
      return;
    }

    // load index
    try {
      await this.book.loadToc();
    } catch (ex) {
      console.error(ex);
      this.error(`Unable to load TOC: ${ex.message}`);
      return;
    }

    try {
      await this.book.loadMeta();
    } catch (ex) {
      console.error(ex);
      this.error(`Unable to load metadata: ${ex.message}`);
      return;
    }

    // init tree
    try {
      const rootElem = document.getElementById('item-root');
      rootElem.container = document.createElement('ul');
      rootElem.container.className = 'container';
      rootElem.appendChild(rootElem.container);

      for (const id of this.book.toc.root) {
        this.addItem(id, rootElem);
      }
    } catch (ex) {
      this.error(`Unable to init tree: ${ex.message}`);
      return;
    }
  },

  addItem(id, parent) {
    const meta = this.book.meta[id];
    if (!meta) {
      return null;
    }

    var elem = document.createElement('li');
    elem.setAttribute('data-id', id);
    if (meta.type) { elem.setAttribute('data-type', meta.type); };
    if (meta.marked) { elem.setAttribute('data-marked', ''); }
    parent.container.appendChild(elem);

    var div = document.createElement('div');
    div.onclick = this.onClickItem.bind(this);
    elem.appendChild(div);

    if (meta.type !== 'separator') {
      var a = document.createElement('a');
      a.appendChild(document.createTextNode(meta.title || id));
      if (meta.type !== 'bookmark') {
        if (meta.index) { a.href = this.book.dataUrl + scrapbook.escapeFilename(meta.index); }
      } else {
        if (meta.source) {
          a.href = meta.source;
        } else {
          if (meta.index) { a.href = this.book.dataUrl + scrapbook.escapeFilename(meta.index); }
        }
      }
      if (meta.comment) { a.title = meta.comment; }
      if (meta.type === 'folder') { a.onclick = this.onClickFolder.bind(this); }
      div.appendChild(a);

      var icon = document.createElement('img');
      if (meta.icon) {
        icon.src = /^(?:[a-z][a-z0-9+.-]*:|[/])/i.test(meta.icon || "") ? 
            meta.icon : 
            (this.book.dataUrl + scrapbook.escapeFilename(meta.index || "")).replace(/[/][^/]+$/, '/') + meta.icon;
      } else {
        icon.src = {
          'folder': browser.runtime.getURL('resources/fclose.png'),
          'note': browser.runtime.getURL('resources/note.png'),
          'postit': browser.runtime.getURL('resources/postit.png'),
        }[meta.type] || browser.runtime.getURL('resources/item.png');
      }
      icon.alt = "";
      a.insertBefore(icon, a.firstChild);

      var childIdList = this.book.toc[id];
      if (childIdList && childIdList.length) {
        elem.toggle = document.createElement('a');
        elem.toggle.href = '#';
        elem.toggle.className = 'toggle';
        elem.toggle.onclick = this.onClickToggle.bind(this);
        div.insertBefore(elem.toggle, div.firstChild);

        var toggleImg = document.createElement('img');
        toggleImg.src = browser.runtime.getURL('resources/collapse.png');
        toggleImg.alt = '';
        elem.toggle.appendChild(toggleImg);

        elem.container = document.createElement('ul');
        elem.container.className = 'container';
        elem.container.hidden = true;
        elem.appendChild(elem.container);
      }
    } else {
      var line = document.createElement('fieldset');
      if (meta.comment) { line.title = meta.comment; }
      div.appendChild(line);

      var legend = document.createElement('legend');
      legend.appendChild(document.createTextNode('\xA0' + (meta.title || '') + '\xA0'));
      line.appendChild(legend);
    }

    return elem;
  },

  toggleElem(elem, willOpen) {
    if (typeof willOpen === "undefined") {
      willOpen = !!elem.hidden;
    }

    // load child nodes if not loaded yet
    if (willOpen && !elem.hasChildNodes())  {
      const itemElem = elem.parentNode;

      for (const id of this.book.toc[itemElem.getAttribute('data-id')]) {
        this.addItem(id, itemElem);
      }
    }

    elem.hidden = !willOpen;

    try {
      elem.previousSibling.firstChild.firstChild.src = willOpen ?
      browser.runtime.getURL('resources/expand.png') :
      browser.runtime.getURL('resources/collapse.png');
    } catch (ex) {
      // if the elem is the root elem, previousSibling is undefined and an error is thrown
    }
  },

  getHighlightElem(itemElem) {
    let elem = itemElem.firstChild.firstChild;
    if (elem.classList.contains('toggle')) {
      elem = elem.nextSibling;
    }
    return elem;
  },

  highlightItem(itemElem, willHighlight) {
    if (typeof willHighlight === "undefined") {
      willHighlight = !this.getHighlightElem(itemElem).classList.contains("highlight");
    }

    if (willHighlight) {
      if (this.lastHighlightElem) {
        this.getHighlightElem(this.lastHighlightElem).classList.remove("highlight");
      }
      this.getHighlightElem(itemElem).classList.add("highlight");
      this.lastHighlightElem = itemElem;
    } else {
      this.getHighlightElem(itemElem).classList.remove("highlight");
      if (this.lastHighlightElem === itemElem) {
        this.lastHighlightElem = null;
      }
    }
  },

  onClickItem(event) {
    const itemElem = event.currentTarget.parentNode;
    this.highlightItem(itemElem);
  },

  onClickFolder(event) {
    event.preventDefault();
    const target = event.currentTarget.previousSibling;
    target.focus();
    target.click();
  },

  onClickToggle(event) {
    event.preventDefault();
    const itemElem = event.currentTarget.parentNode.parentNode;
    this.highlightItem(itemElem);
    this.toggleElem(event.currentTarget.parentNode.nextSibling);
  },

  async openLink(url, newTab) {
    if (newTab) {
      await browser.tabs.create({
        url,
      });
      return;
    }

    if (browser.windows) {
      let win;
      try {
        win = await browser.windows.getLastFocused({
          populate: true,
          windowTypes: ['normal'],
        });
        if (!win) {
          throw new Error('no last-focused window');
        }
      } catch (ex) {
        // no last-focused window
        await browser.windows.create({
          url,
        });
        return;
      }

      const targetTab = win.tabs.filter(x => x.active)[0];
      if (!targetTab) {
        await browser.tabs.create({
          windowId: win.id,
          url,
        });
        return;
      }

      await browser.tabs.update(targetTab.id, {
        url,
      });
    } else {
      const activeTab = (await browser.tabs.query({
        active: true,
      }))[0];
      if (!activeTab || activeTab.id === (await browser.tabs.getCurrent()).id) {
        await browser.tabs.create({
          url,
        });
        return;
      }

      await browser.tabs.update(activeTab.id, {
        url,
      });
    }
  },

  async onBookChange(event) {
    this.enableToolbar(false);
    location.href = '?id=' + encodeURIComponent(event.target.value);
    this.enableToolbar(true);
  },

  async onRefresh(event) {
    this.enableToolbar(false);
    location.reload();
    this.enableToolbar(true);
  },

  async onCommandFocus(event) {
    const cmdElem = document.getElementById('command');

    const selectedItemElems = Array.prototype.map.call(
      document.querySelectorAll('#item-root .highlight'),
      x => x.parentNode.parentNode
    );

    switch (selectedItemElems.length) {
      case 0: {
        cmdElem.querySelector('option[value="index"]').hidden = false;
        cmdElem.querySelector('option[value="exec"]').hidden = false;
        cmdElem.querySelector('option[value="browse"]').hidden = true;
        cmdElem.querySelector('option[value="source"]').hidden = true;
        cmdElem.querySelector('option[value="meta"]').hidden = true;
        cmdElem.querySelector('option[value="mkdir"]').hidden = false;
        cmdElem.querySelector('option[value="mksep"]').hidden = false;
        cmdElem.querySelector('option[value="mknote"]').hidden = false;
        cmdElem.querySelector('option[value="editx"]').hidden = true;
        cmdElem.querySelector('option[value="upload"]').hidden = false;
        cmdElem.querySelector('option[value="move"]').hidden = true;
        cmdElem.querySelector('option[value="copy"]').hidden = true;
        cmdElem.querySelector('option[value="delete"]').hidden = true;
        break;
      }

      case 1: {
        const item = this.book.meta[selectedItemElems[0].getAttribute('data-id')];
        const isHtml = /\.(?:html?|xht(?:ml)?)$/.test(item.index);
        cmdElem.querySelector('option[value="index"]').hidden = true;
        cmdElem.querySelector('option[value="exec"]').hidden = false;
        cmdElem.querySelector('option[value="browse"]').hidden = false;
        cmdElem.querySelector('option[value="source"]').hidden = false;
        cmdElem.querySelector('option[value="meta"]').hidden = false;
        cmdElem.querySelector('option[value="mkdir"]').hidden = true;
        cmdElem.querySelector('option[value="mksep"]').hidden = true;
        cmdElem.querySelector('option[value="mknote"]').hidden = true;
        cmdElem.querySelector('option[value="editx"]').hidden = !(isHtml);
        cmdElem.querySelector('option[value="upload"]').hidden = true;
        cmdElem.querySelector('option[value="move"]').hidden = false;
        cmdElem.querySelector('option[value="copy"]').hidden = false;
        cmdElem.querySelector('option[value="delete"]').hidden = false;
        break;
      }
    }
  },

  async onCommandChange(event) {
    const command = event.target.value;
    event.target.value = '';

    this.enableToolbar(false);

    const selectedItemElems = Array.prototype.map.call(
      document.querySelectorAll('#item-root .highlight'),
      x => x.parentNode.parentNode
    );
    let id;
    let item;

    if (selectedItemElems[0]) {
      id = selectedItemElems[0].getAttribute('data-id');
      item = this.book.meta[id];
    }

    switch (command) {
      case 'index': {
        this.openLink(this.book.indexUrl, true);
        break;
      }

      case 'exec': {
        if (!item) {
          const target = this.book.topUrl;
          try {
            const xhr = await server.request({
              url: target + '?a=exec&f=json',
              responseType: 'json',
              method: "GET",
            });
          } catch (ex) {
            alert(`Unable to open "${target}": ${ex.message}`);
          }
        } else {
          const target = this.book.dataUrl + item.index;
          try {
            const xhr = await server.request({
              url: target + '?a=exec&f=json',
              responseType: 'json',
              method: "GET",
            });
          } catch (ex) {
            alert(`Unable to open "${target}": ${ex.message}`);
          }
        }
        break;
      }

      case 'browse': {
        if (item) {
          const target = this.book.dataUrl + item.index;
          try {
            const xhr = await server.request({
              url: target + '?a=browse&f=json',
              responseType: 'json',
              method: "GET",
            });
          } catch (ex) {
            alert(`Unable to browse "${target}": ${ex.message}`);
          }
        }
        break;
      }

      case 'source': {
        if (item) {
          const target = item.source;
          await this.openLink(target, true);
        }
        break;
      }

      case 'meta': {
        if (item) {
          const dialog = document.createElement('div');
          const table = dialog.appendChild(document.createElement('table'));
          {
            const tr = table.appendChild(document.createElement('tr'));
            const th = tr.appendChild(document.createElement('th'));
            th.textContent = 'ID';
            const td = tr.appendChild(document.createElement('td'));
            td.textContent = id;
          }
          for (const [attr, value] of Object.entries(item)) {
            const tr = table.appendChild(document.createElement('tr'));
            const th = tr.appendChild(document.createElement('th'));
            th.textContent = attr;
            const td = tr.appendChild(document.createElement('td'));
            td.textContent = value;
          }
          await this.showDialog(dialog);
        }
        break;
      }

      case 'editx': {
        if (item) {
          const target = this.book.dataUrl + item.index;
          await this.openLink(target + '?a=editx', true);
        }
        break;
      }

      case 'delete': {
        if (item) {
          const itemElem = selectedItemElems[0];
          const itemId = itemElem.getAttribute('data-id');

          const parentItemElem = itemElem.parentNode.parentNode;
          const siblingItems = parentItemElem.querySelector('ul').querySelectorAll('li');
          const index = Array.prototype.indexOf.call(siblingItems, itemElem);

          if (index !== -1) {
            // remove from toc
            const parentItemId = parentItemElem.getAttribute('data-id');
            this.book.toc[parentItemId].splice(index, 1);

            // upload revised toc to server
            try {
              await this.book.saveToc();
            } catch (ex) {
              alert(`Unable to delete toc of '${itemId}': ${ex.message}`);
              break;
            }

            // remove data and meta if no longer referred in the DOM
            if (!Array.prototype.some.call(
                  document.getElementById('item-root').querySelectorAll('li[data-id]'),
                  x => x.getAttribute('data-id') === itemId && x !== itemElem
                )) {
              try {
                const index = this.book.meta[itemId].index.replace(/\/index.html$/, '');
                const target = this.book.dataUrl + scrapbook.escapeFilename(index);

                const formData = new FormData();
                formData.append('token', await server.acquireToken());

                await server.request({
                  url: target + '?a=delete&f=json',
                  responseType: 'json',
                  method: "POST",
                  formData: formData,
                });
              } catch (ex) {
                alert(`Unable to delete data of '${itemId}': ${ex.message}`);
                break;
              }

              try {
                delete this.book.meta[itemId];
                await this.book.saveMeta();
              } catch (ex) {
                alert(`Unable to delete metadata of '${itemId}': ${ex.message}`);
                break;
              }
            }

            // remove from DOM
            siblingItems[index].remove();
          }
        }
        break;
      }
    }

    this.enableToolbar(true);
  },

  async onItemClick(event) {
    const selector = 'a[href]:not(.toggle)';
    let elem = event.target;
    if (!elem.matches(selector)) {
      elem = elem.closest(selector);
    }
    if (!elem) {
      return;
    }

    // for desktop browsers, open link in the same tab of the main window
    if (browser.windows) {
      event.preventDefault();
      await scrapbookUi.openLink(elem.href);
    }
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  scrapbook.loadLanguages(document);

  document.getElementById("book").addEventListener('change', scrapbookUi.onBookChange);

  document.getElementById("btn-refresh").addEventListener('click', scrapbookUi.onRefresh);

  document.getElementById("command").addEventListener('focus', scrapbookUi.onCommandFocus.bind(scrapbookUi));

  document.getElementById("command").addEventListener('change', scrapbookUi.onCommandChange.bind(scrapbookUi));

  document.getElementById('item-root').addEventListener('click', scrapbookUi.onItemClick);

  await scrapbookUi.init();
});
