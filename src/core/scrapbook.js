/********************************************************************
 *
 * Script for scrapbook.html
 *
 * @require {Object} scrapbook
 *******************************************************************/

const scrapbookUi = {
  lastHighlightElem: null,

  data: {
    book: null,
    toc: {},
    meta: {},
  },

  toc: function (data) {
    for (var id in data) {
      this.data.toc[id] = data[id];
    }
  },

  meta: function (data) {
    for (var id in data) {
      this.data.meta[id] = data[id];
    }
  },

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
  
  async init() {
    // UI reset
    document.getElementById("logger").innerHTML = "";
    document.getElementById('item-root').innerHTML = "";

    // load config
    await scrapbook.loadOptions();

    // load server config
    try {
      let serverConfig;
      try {
        serverConfig = await scrapbook.getServerConfig();
      } catch (ex) {
        throw ex;
      }

      if (!serverConfig) {
        this.log(`Backend server is not configured.`);
        return;
      }

      const bookId = new URL(location.href).searchParams.get('id') || '';
      const book = this.data.book = serverConfig.book[bookId];

      if (!book) {
        throw new Error(`unknown scrapbook: ${bookId}`);
      }

      this._topUrl = serverConfig._ServerRoot +
          (book.top_dir ? book.top_dir + '/' : '');

      this._dataUrl = this._topUrl +
          (book.data_dir ? book.data_dir + '/' : '');

      this._treeUrl = this._topUrl +
          (book.tree_dir ? book.tree_dir + '/' : '');

      this._indexUrl = this._topUrl + book.index;

      // init book select
      {
        const wrapper = document.getElementById('book');
        for (const [name, book] of Object.entries(serverConfig.book)) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = book.name;
          wrapper.appendChild(opt);
        }
        wrapper.value = bookId;
        wrapper.hidden = false;
      }
    } catch (ex) {
      this.error(`Unable to load scrapbook: ${ex.message}`);
      return;
    }

    // load index
    try {
      const response = (await scrapbook.xhr({
        url: this._treeUrl + '?a=list&f=json',
        responseType: 'json',
        method: "GET",
      })).response;

      if (response.error) {
        throw new Error(response.error.message);
      }

      // tree/*
      const treeFiles = response.data.reduce((data, item) => {
        data.set(item.name, item);
        return data;
      }, new Map());

      // tree/toc*.js
      for (let i = 0; ; i++) {
        const file = `toc${i || ""}.js`;
        if (treeFiles.has(file) && treeFiles.get(file).type === 'file') {
          try {
            const text = (await scrapbook.xhr({
              url: `${this._treeUrl}/${file}`,
              responseType: 'text',
              method: "GET",
            })).response;

            if (!/^(?:\/\*.*\*\/|[^(])+\(([\s\S]*)\)(?:\/\*.*\*\/|[\s;])*$/.test(text)) {
              throw new Error(`Failed to retrieve JSON data.`);
            }

            this.toc(JSON.parse(RegExp.$1));
          } catch (ex) {
            throw new Error(`Error loading '${file}': ${ex.message}`);
          }
        } else {
          break;
        }
      }

      // tree/meta*.js
      for (let i = 0; ; i++) {
        const file = `meta${i || ""}.js`;
        if (treeFiles.has(file) && treeFiles.get(file).type === 'file') {
          try {
            const text = (await scrapbook.xhr({
              url: `${this._treeUrl}/${file}`,
              responseType: 'text',
              method: "GET",
            })).response;

            if (!/^(?:\/\*.*\*\/|[^(])+\(([\s\S]*)\)(?:\/\*.*\*\/|[\s;])*$/.test(text)) {
              throw new Error(`Failed to retrieve JSON data.`);
            }

            this.meta(JSON.parse(RegExp.$1));
          } catch (ex) {
            throw new Error(`Error loading '${file}': ${ex.message}`);
          }
        } else {
          break;
        }
      }
    } catch (ex) {
      this.error(`Unable to load index: ${ex.message}`);
      return;
    }

    // init tree
    try {
      const rootElem = document.getElementById('item-root');

      rootElem.container = document.createElement('ul');
      rootElem.container.className = 'container';
      rootElem.appendChild(rootElem.container);

      for (const id of this.data.toc.root) {
        this.addItem(id, rootElem);
      }
    } catch (ex) {
      this.error(`Unable to load tree: ${ex.message}`);
      return;
    }
  },

  addItem(id, parent) {
    const meta = this.data.meta[id];

    var elem = document.createElement('li');
    elem.id = 'item-' + id;
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
        if (meta.index) { a.href = this._dataUrl + scrapbook.escapeFilename(meta.index); }
      } else {
        if (meta.source) {
          a.href = meta.source;
        } else {
          if (meta.index) { a.href = this._dataUrl + scrapbook.escapeFilename(meta.index); }
        }
      }
      if (meta.comment) { a.title = meta.comment; }
      if (meta.type === 'folder') { a.onclick = this.onClickFolder.bind(this); }
      div.appendChild(a);

      var icon = document.createElement('img');
      if (meta.icon) {
        icon.src = /^(?:[a-z][a-z0-9+.-]*:|[/])/i.test(meta.icon || "") ? 
            meta.icon : 
            (this._dataUrl + scrapbook.escapeFilename(meta.index || "")).replace(/[/][^/]+$/, '/') + meta.icon;
      } else {
        icon.src = {
          'folder': browser.runtime.getURL('resources/fclose.png'),
          'note': browser.runtime.getURL('resources/note.png'),
          'postit': browser.runtime.getURL('resources/postit.png'),
        }[meta.type] || browser.runtime.getURL('resources/item.png');
      }
      icon.alt = "";
      a.insertBefore(icon, a.firstChild);

      var childIdList = this.data.toc[id];
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

      for (const id of this.data.toc[itemElem.id.slice(5)]) {
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
    if (itemElem.getAttribute('data-type') === "folder") {
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
    }
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  scrapbook.loadLanguages(document);

  document.getElementById("btn-refresh").addEventListener('click', async () => {
    location.reload();
  });

  document.getElementById("book").addEventListener('change', async (event) => {
    location.href = '?id=' + encodeURIComponent(event.target.value);
  });

  document.getElementById('item-root').addEventListener('click', async (event) => {
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
  }, true);

  await scrapbookUi.init();  
});
