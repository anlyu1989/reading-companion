# mubook-hon

[![mubook-hon](https://mubook-hon.jser.workers.dev/icons/icon-256x256.png)](https://mubook-hon.jser.workers.dev)

mubook-hon is EPUB/PDF reader + Notion Sync + Memo.

![viewer: Ruth A. Shapiro, Manisha Mirchandani and Heesu Jang Pragmatic Philanthropy Asian Charity Explained - CC BY](docs/epub.png)

> EPUB viewer based on [Foliate-js](https://github.com/johnfactotum/foliate-js)

![viewer: Pro Git book - CC BY-NC-SA 3.0](docs/pdf.png)

> PDF viewer by [PDF.js](https://mozilla.github.io/pdf.js/)

![notion-database.png](docs/notion-database.png)

> Notion Database is created by mubook-hon

![Notion Book Page](docs/notion-book-page.png)

> You can write memo to Notion

## Usage

- WebSite: <https://mubook-hon.jser.workers.dev/>
- Document: <https://efcl.notion.site/mubook-hon-addce6c324d44d749a73748f92e3a1a6>

You need to set up Notion before using memo features.

## Features

- Read EPUB/PDF files on Dropbox
- Support cross browser - Mobile and PC
- Sync progress using Notion on cross devices
- Add memo to Notion with selected text
- Manage book list in Notion
- Customizable tap zones for navigation

## Supported Format

- [x] EPUB
  - [Foliate-js](https://github.com/johnfactotum/foliate-js)
- [x] PDF
  - [PDF.js](https://mozilla.github.io/pdf.js/) + [react-pdf-viewer](https://react-pdf-viewer.dev/)

## Application Mode

You can use <https://mubook-hon.jser.workers.dev/> as PWA apps.

- [Add & open Chrome apps - Chrome Web Store Help](https://support.google.com/chrome_webstore/answer/3060053?hl=en)
- [Add to Home screen - Progressive web apps (PWAs) | MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Add_to_home_screen)

## Tap Zone Settings

You can customize tap zones for navigation in Settings > Viewer > Tap Zones.

Each zone can be assigned one of the following actions:
- **Next**: Go to next page
- **Prev**: Go to previous page
- **Menu**: Open menu
- **Close**: Return to book list
- **None**: No action

Presets available: Default, Right Hand, Left Hand

## Shortcut Keys

- <kbd>Shift + A</kbd>: Add memo to Stock
- <kbd>Shift + S</kbd>: Save memo to Notion

## Privacy Notices

- Request/Response to Dropbox: No Proxy
- Request/Response to Notion: CORS Proxy
  - Notion API does not support CORS
  - The CORS Proxy is hosted on Cloudflare Workers

## LICENSE

MIT (c) azu

## Acknowledgements

- [Foliate-js](https://github.com/johnfactotum/foliate-js)
- [PDF.js](https://mozilla.github.io/pdf.js/)
- [react-pdf-viewer](https://react-pdf-viewer.dev/)
