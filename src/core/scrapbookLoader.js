/********************************************************************
 *
 * Script for book.html
 *
 * @require {Object} scrapbook
 *******************************************************************/

const bookLoader = {
  error(msg) {
    const span = document.createElement('span');
    span.className = 'error';
    span.appendChild(document.createTextNode(msg + '\n'));
    logger.appendChild(span);
  },
};

document.addEventListener('DOMContentLoaded', async () => {
  // load languages
  scrapbook.loadLanguages(document);

  await scrapbook.loadOptions();

  try {
    let serverConfig;
    try {
      serverConfig = await scrapbook.getServerConfig();
    } catch (ex) {
      throw ex;
    }

    const bookname = new URL(location.href).searchParams.get('name') || '';
    const book = serverConfig.book[bookname];

    if (!book) {
      throw new Error(`Unknown scrapbook: ${bookname}`);
    }

    const url = serverConfig._ServerRoot +
        (book.top_dir ? book.top_dir + '/' : '') +
        book.index;

    location.replace(url);
  } catch (ex) {
    bookLoader.error(`Unable to launch scrapbook: ${ex.message}`);
  }
});
