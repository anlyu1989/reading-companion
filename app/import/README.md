# Import

## Usage

1. https://mubook-hon.vercel.app/import
2. Create import object
3. Paste to textarea
4. "Import"

## Kindle

1. Visit https://read.amazon.co.jp/notebook
2. Execute following code in console

```Js
(async function (){ 
    const { parsePage, toMarkdown } = await import('https://esm.sh/kindle-highlight-to-markdown');
    const o = parsePage(window); // JSON Object
    const result =  {
        fileId: o.asin,
        fileName: o.title,
        title: o.title,
        currentPage: 0,
        totalPage: 0,
        publisher: "",
        authors: o.author.split(/[、,]/),
        memos: o.annotations.map(annotation => {
            return {
                memo: annotation.highlight,
                currentPage: annotation.locationNumber,
                marker: { locationNumber: annotation.locationNumber }
            }
        })
    };
    console.log(result); // Copy to clipboard
})()
```

## Learning O'Reilly

1. Visit https://learning.oreilly.com/highlights
2. Execute following code in console

```js
(async function () {
    // Extract all highlight cards
    const cards = document.querySelectorAll('article.orm-Card-root');
    
    if (!cards.length) {
        console.error('No highlights found. Make sure you are on the highlights page.');
        return;
    }
    
    // Get the first card to extract book information
    const firstCard = cards[0];
    const bookTitle = firstCard.querySelector('img')?.alt || 'Unknown Book';
    
    // Extract book ID from URL
    const firstLink = firstCard.querySelector('a.orm-Card-link')?.href || '';
    const bookIdMatch = firstLink.match(/\/view\/[^\/]+\/([^\/]+)\//);
    const bookId = bookIdMatch ? bookIdMatch[1] : 'unknown';
    
    // Extract highlights
    const memos = Array.from(cards).map((card, index) => {
        const highlightText = card.querySelector('.orm-Card-description')?.textContent?.trim() || '';
        const chapterLink = card.querySelector('a.orm-Card-link')?.href || '';
        const chapterTitle = card.querySelector('.orm-Card-title')?.textContent?.trim() || '';
        
        // Extract chapter number from URL or title
        const chapterMatch = chapterLink.match(/ch(\d+)\.xhtml/) || chapterTitle.match(/(\d+)/);
        const chapterNumber = chapterMatch ? parseInt(chapterMatch[1]) : index;
        
        return {
            memo: highlightText,
            currentPage: chapterNumber,
            marker: { 
                chapterTitle: chapterTitle,
                url: chapterLink
            }
        };
    }).filter(memo => memo.memo); // Filter out empty highlights
    
    const result = {
        fileId: bookId,
        fileName: bookTitle,
        title: bookTitle,
        currentPage: 0,
        totalPage: 0,
        publisher: "O'Reilly Media",
        authors: [], // O'Reilly highlights page doesn't show authors
        memos: memos
    };
    
    copy(result);
    console.log('Extracted highlights:', result);
    console.log('Copy the above object to clipboard and paste it into the import page');
})()
```
