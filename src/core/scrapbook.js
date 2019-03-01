/********************************************************************
 *
 * Script for scrapbook.html
 *
 * @require {Object} scrapbook
 *******************************************************************/

const scrapbookUi = {
  data: {
    title: document.title,
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
    scrapbookUi.logger.appendChild(document.createTextNode(msg + '\n'));
  },

  warn(msg) {
    const span = document.createElement('span');
    span.className = 'warn';
    span.appendChild(document.createTextNode(msg + '\n'));
    scrapbookUi.logger.appendChild(span);
  },

  error(msg) {
    const span = document.createElement('span');
    span.className = 'error';
    span.appendChild(document.createTextNode(msg + '\n'));
    scrapbookUi.logger.appendChild(span);
  },
  
  async init() {
    // UI reset
    this.logger.innerHTML = "";

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

      this.data.title = new URL(location.href).searchParams.get('name') || '';
      const book = this.data.book = serverConfig.book[this.data.title];

      if (!book) {
        throw new Error(`unknown scrapbook: ${this.data.title}`);
      }

      this._topUrl = serverConfig._ServerRoot +
          (book.top_dir ? book.top_dir + '/' : '');

      this._dataUrl = this._topUrl +
          (book.data_dir ? book.data_dir + '/' : '');

      this._treeUrl = this._topUrl +
          (book.tree_dir ? book.tree_dir + '/' : '');

      this._indexUrl = this._topUrl + book.index;
    } catch (ex) {
      this.error(`Unable to load scrapbook: ${ex.message}`);
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
    }

    // init tree
    {
      const rootElem = document.getElementById('item-root');

      rootElem.container = document.createElement('ul');
      rootElem.container.className = 'scrapbook-container';
      rootElem.appendChild(rootElem.container);

      for (const id of this.data.toc.root) {
        this.addItem(id, rootElem, ["root"]);
      }
    }
  },

  addItem(id, parent, idChain) {
    const meta = this.data.meta[id];

    var elem = document.createElement('li');
    elem.id = 'item-' + id;
    if (meta.type) { elem.className = 'scrapbook-type-' + meta.type + ' '; };
    if (meta.marked) { elem.className += 'scrapbook-marked '; }
    parent.container.appendChild(elem);

    var div = document.createElement('div');
    div.onclick = this.onClickItem;
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
        elem.toggle.className = 'scrapbook-toggle';
        elem.toggle.onclick = this.onClickToggle.bind(this);
        div.insertBefore(elem.toggle, div.firstChild);

        var toggleImg = document.createElement('img');
        toggleImg.src = browser.runtime.getURL('resources/collapse.png');
        toggleImg.alt = '';
        elem.toggle.appendChild(toggleImg);

        elem.container = document.createElement('ul');
        elem.container.className = 'scrapbook-container';
        elem.container.style.display = 'none';
        elem.appendChild(elem.container);

        var childIdChain = idChain.slice();
        childIdChain.push(id);
        for (var i = 0, I = childIdList.length; i < I; i++) {
          var childId = childIdList[i];
          if (idChain.indexOf(childId) === -1) {
            this.addItem(childId, elem, childIdChain);
          }
        }
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
      willOpen = (elem.style.display === "none");
    }
    elem.style.display = willOpen ? '' : 'none';

    try {
      elem.previousSibling.firstChild.firstChild.src = willOpen ?
      browser.runtime.getURL('resources/expand.png') :
      browser.runtime.getURL('resources/collapse.png');
    } catch (ex) {
      // if the elem is the root elem, previousSibling is undefined and an error is thrown
    }
  },

  onClickFolder(event) {
    event.preventDefault();
    const target = event.currentTarget.previousSibling;
    target.focus();
    target.click();
  },

  onClickToggle(event) {
    event.preventDefault();
    this.toggleElem(event.currentTarget.parentNode.nextSibling);
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  scrapbook.loadLanguages(document);

  scrapbookUi.logger = document.getElementById("logger");
  scrapbookUi.btnRefresh = document.getElementById("btn-refresh");

  scrapbookUi.btnRefresh.addEventListener('click', async () => {
    await scrapbookUi.init();
  });

  await scrapbookUi.init();  
});
