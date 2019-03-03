/********************************************************************
 *
 * Shared class for server related manipulation.
 *
 * @require {Object} scrapbook
 * @public {Class} Server
 *******************************************************************/

((window, document, browser) => {

class Server {
  constructor () {
    this._config = null;
    this._serverRoot = null;
    this._books = {};
  }

  get serverRoot() {
    return this._serverRoot;
  }

  get config() {
    return this._config;
  }

  getBookInfo(bookId, refresh = false) {
    if (!this._books[bookId] || refresh) {
      const book = this._books[bookId] = this.config.book[bookId];

      if (!book) {
        throw new Error(`unknown scrapbook: ${bookId}`);
      }

      book._topUrl = this.serverRoot +
        (book.top_dir ? book.top_dir + '/' : '');

      book._dataUrl = book._topUrl +
          (book.data_dir ? book.data_dir + '/' : '');

      book._treeUrl = book._topUrl +
          (book.tree_dir ? book.tree_dir + '/' : '');

      book._indexUrl = book._topUrl + book.index;
    }
    return this._books[bookId];
  }

  /**
   * Wrapped API for a general request to backend server
   */
  async request(params = {}) {
    params.onload = true;
    let xhr;
    try {
      xhr = await scrapbook.xhr(params);
    } catch (ex) {
      throw new Error('Unable to connect to backend server.');
    }
    if (xhr.response && xhr.response.error && xhr.response.error.message) {
      throw new Error(xhr.response.error.message);
    } else if (!(xhr.status >= 200 && xhr.status <= 206)) {
      const statusText = xhr.status + (xhr.statusText ? " " + xhr.statusText : "");
      throw new Error(statusText);
    }
    return xhr;
  }

  /**
   * Load the config of the backend server
   */
  async loadConfig(refresh = false) {
    if (!this._config || refresh) {
      if (!scrapbook.hasServer()) {
        return null;
      }

      let configServerRoot = scrapbook.getOption("capture.scrapbookFolder");

      if (!configServerRoot.endsWith('/')) { configServerRoot += '/'; }

      // use the cached config if the configured server root isn't changed
      if (this._config) {
        if (configServerRoot.startsWith(this._serverRoot)) {
          return this._config;
        }
      }

      // load config from server
      {
        const xhr = await this.request({
          url: configServerRoot + '?a=config&f=json',
          responseType: 'json',
          method: "GET",
        });

        if (!xhr.response || !xhr.response.data) {
          throw new Error('The server does not support WebScrapBook protocol.');
        }

        this._config = xhr.response.data;
      }

      // revise server root URL
      // configServerRoot may be too deep, replace with server configured base path
      {
        const urlObj = new URL(configServerRoot);
        urlObj.search = urlObj.hash = '';
        urlObj.pathname = this._config.server.base + '/';
        this._serverRoot = urlObj.href;
      }
    }
    return this._config;
  }

  /**
   * Acquire an access token from the backend server
   */
  async acquireToken(url) {
    try {
      const xhr = await this.request({
        url: url + '?a=token&f=json',
        responseType: 'json',
        method: "GET",
      });
      return xhr.response.data;
    } catch (ex) {
      throw new Error(`Unable to acquire access token: ${ex.message}`);
    }
  }

  /**
   * @return {Map}
   */
  async loadTreeFiles(bookId) {
    const data = (await scrapbook.xhr({
      url: this.getBookInfo(bookId)._treeUrl + '?a=list&f=json',
      responseType: 'json',
      method: "GET",
    })).response.data;

    return data.reduce((data, item) => {
      data.set(item.name, item);
      return data;
    }, new Map());
  }

  async loadToc(bookId) {
    const objList = [{}];
    const treeFiles = await this.loadTreeFiles(bookId);
    for (let i = 0; ; i++) {
      const file = `toc${i || ""}.js`;
      if (treeFiles.has(file) && treeFiles.get(file).type === 'file') {
        const url = `${this.getBookInfo(bookId)._treeUrl}/${file}`;
        try {
          const text = (await server.request({
            url,
            responseType: 'text',
            method: "GET",
          })).response;

          if (!/^(?:\/\*.*\*\/|[^(])+\(([\s\S]*)\)(?:\/\*.*\*\/|[\s;])*$/.test(text)) {
            throw new Error(`Unable to retrieve JSON data.`);
          }

          objList.push(JSON.parse(RegExp.$1));
        } catch (ex) {
          throw new Error(`Error loading '${url}': ${ex.message}`);
        }
      } else {
        break;
      }
    }
    return Object.assign.apply(this, objList);
  }

  async loadMeta(bookId) {
    const objList = [{}];
    const treeFiles = await this.loadTreeFiles(bookId);
    for (let i = 0; ; i++) {
      const file = `meta${i || ""}.js`;
      if (treeFiles.has(file) && treeFiles.get(file).type === 'file') {
        const url = `${this.getBookInfo(bookId)._treeUrl}/${file}`;
        try {
          const text = (await server.request({
            url,
            responseType: 'text',
            method: "GET",
          })).response;

          if (!/^(?:\/\*.*\*\/|[^(])+\(([\s\S]*)\)(?:\/\*.*\*\/|[\s;])*$/.test(text)) {
            throw new Error(`Unable to retrieve JSON data.`);
          }

          objList.push(JSON.parse(RegExp.$1));
        } catch (ex) {
          throw new Error(`Error loading '${url}': ${ex.message}`);
        }
      } else {
        break;
      }
    }
    return Object.assign.apply(this, objList);
  }
}

window.Server = Server;
window.server = new Server();

})(this, this.document, this.browser);
