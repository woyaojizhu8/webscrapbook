/********************************************************************
 *
 * Script for scrapbook.html
 *
 * @require {Object} scrapbook
 *******************************************************************/

const scrapbookUi = {
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
  
  async refresh() {
    this.logger.innerHTML = "";
    await scrapbook.loadOptions();

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

      const bookname = new URL(location.href).searchParams.get('name') || '';
      const book = serverConfig.book[bookname];

      if (!book) {
        throw new Error(`unknown scrapbook: ${bookname}`);
      }

      const url = serverConfig._ServerRoot +
          (book.top_dir ? book.top_dir + '/' : '') +
          book.index;

      // location.replace(url);
    } catch (ex) {
      this.error(`Unable to load scrapbook: ${ex.message}`);
    }
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  scrapbook.loadLanguages(document);

  scrapbookUi.logger = document.getElementById("logger");
  scrapbookUi.btnRefresh = document.getElementById("btn-refresh");

  scrapbookUi.btnRefresh.addEventListener('click', async () => {
    await scrapbookUi.refresh();
  });

  await scrapbookUi.refresh();  
});
