// ==UserScript==
// @name         Indieheads/Hiphopheads Streaming Links
// @namespace    https://www.reddit.com/r/indieheads
// @version      1.0
// @description  Adds links to various streaming services (from https://song.link) to the comments page for all [FRESH*] posts in /r/indieheads and /r/hiphopheads.
// @author       jeffm24
// @license      MIT
// @match        https://www.reddit.com/r/indieheads/comments/*
// @match        https://www.reddit.com/r/hiphopheads/comments/*
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle
// ==/UserScript==

/* jshint esnext: false */
/* jshint esversion: 6 */

GM.addStyle(`
#streaming-links-toggle {
    font-size: 12px;
    margin: 0px 10px;
    white-space: nowrap;
}

#streaming-links-popup {
    position: absolute;
    z-index: 9999;
    padding: 10px;
    max-width: 300px;
    box-shadow: 0px 1px 3px rgba(0, 0, 0, 0.5);
    background-color: white;
    font-family: Helvetica, Ariel;
}
#streaming-links-popup.hidden {
    display: none;
}

#streaming-links-popup > .header {
    margin: -10px -10px 10px;
    padding: 8px 10px;
    background-color: slategrey;
    color: white;
    text-shadow: 0px 1px 1px rgba(0, 0, 0, 0.3);
}

#streaming-links-popup > ul {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-gap: 15px 10px;

    text-align: center;
    margin: 15px 5px;
}
#streaming-links-popup > ul > li {
    white-space: nowrap;
}
#streaming-links-popup > ul > li svg {
    display: block;
    margin: 0px auto 5px;
}

#streaming-links-popup > .footer {
    background-color: ghostwhite;
    color: white;
    padding: 7px 10px;
    border-top: 1px solid lightgrey;
    margin: 0px -10px -10px;
}
`);

// Promisified xmlHttpRequest method
GM.xmlHttpRequestAsync = (method, url) => {
    return new Promise((resolve, reject) => {
        GM.xmlHttpRequest({
            method,
            url,
            onload(res) {
                if (res.status >= 200 && res.status < 300) {
                    try {
                        resolve(JSON.parse(res.response));
                    } catch (error) {
                        resolve(res.response);
                    }

                } else {
                    reject({
                        status: res.status,
                        statusText: res.statusText
                    });
                }
            },
            onerror (res) {
                reject({
                    status: res.status,
                    statusText: res.statusText
                });
            }
        });
    });
};

// Get the current x and y position of the given element relative to viewport
function getPosition(element) {
    let xPosition = 0,
        yPosition = 0;

    while (element) {
        xPosition += (element.offsetLeft - element.scrollLeft + element.clientLeft);
        yPosition += (element.offsetTop - element.scrollTop + element.clientTop);
        element = element.offsetParent;
    }

    return { x: xPosition, y: yPosition };
}

async function processTitle(postTitle) {
    const songPrefixMatch = /^\[FRESH( VIDEO)?\] /i,
          albumPrefixMatch = /^\[FRESH (ALBUM|EP)\] /i;

    let linkPage, songLink;

    // Check if post is for a song or album and get songLink based on that
    if (songPrefixMatch.test(postTitle)) {
        const formattedQuery = postTitle.replace(songPrefixMatch, '').replace(/ - | /g, '+'),
              response = await GM.xmlHttpRequestAsync('GET', `https://song.link/search?q=${formattedQuery}`);

        if (response.songs.length) {
            songLink = response.songs[0].links.songlink;
        }

    } else if (albumPrefixMatch.test(postTitle)) {
        const formattedQuery = postTitle.replace(albumPrefixMatch, '').replace(/ - | /g, '+'),
              response = await GM.xmlHttpRequestAsync('GET', `https://song.link/search?q=${formattedQuery}`);

        if (response.albums.length) {
            songLink = response.albums[0].links.songlink;
        }
    }

    if (songLink) {
        // Load link page html into custom div so it can be queried
        const linkPage = Object.assign(document.createElement('div'), {
            innerHTML: await GM.xmlHttpRequestAsync('GET', songLink)
        });

        const labelPrefixText = 'Listen to this album on ',
              spaceMatch = /\s+/g,
              popup = Object.assign(document.createElement('div'), {
                  id: 'streaming-links-popup',
                  className: 'hidden',
                  innerHTML: '<h2 class="header">All Streaming Links</h2>',
                  onclick(e) { e.stopImmediatePropagation(); }
              }),
              servicesUL = document.createElement('ul');

        // Scrape streaming links from universal link page and add them to popup html
        linkPage.querySelectorAll('[data-nemo^="listen"] > a').forEach((streamingLinkNode) => {
            streamingLinkNode.target = '_blank';
            
            servicesUL.appendChild(Object.assign(document.createElement('li'), {
                innerHTML: streamingLinkNode.outerHTML
            }));
        });

        popup.appendChild(servicesUL);

        // Add footer div with universal share link at the bottom of the popup
        popup.appendChild(Object.assign(document.createElement('div'), {
            className: 'footer',
            innerHTML: `<a href="${songLink}" target="_blank">Universal Link</a>`
        }));

        document.body.appendChild(popup);

        // Create popup toggle link
        const popupToggle = Object.assign(document.createElement('a'), {
            id: 'streaming-links-toggle',
            href: '',
            innerHTML: 'All Streaming Links',
            onclick(e) {
                e.preventDefault();
                e.stopImmediatePropagation();

                const pos = getPosition(e.currentTarget);

                popup.style.top = `${pos.y}px`;
                popup.style.left = `${pos.x}px`;
                popup.classList.remove('hidden');
            }
        });

        const resizeSuper = window.onresize;

        let prevWindowWidth = document.body.clientWidth;

        // Reposition streaming links popup on window width resize
        window.addEventListener('resize', () => {
            if (document.body.clientWidth !== prevWindowWidth) {
                prevWindowWidth = document.body.clientWidth;

                const pos = getPosition(popupToggle);

                popup.style.top = `${pos.y}px`;
                popup.style.left = `${pos.x}px`;
            }
        });

        // Hide streaming links popup on body click
        document.body.addEventListener('click', () => {
            popup.classList.add('hidden');
        });

        // Add popup toggle link to post title
        document.querySelector('.top-matter > .title').appendChild(popupToggle);
    }
}

processTitle(document.querySelector('.top-matter > .title > a.title').text);
