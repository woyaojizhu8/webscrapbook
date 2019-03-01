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
