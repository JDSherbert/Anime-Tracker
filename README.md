![image]()

# Anime Tracker

<!-- Header Start -->
<img align="right" alt="Stars Badge" src="https://img.shields.io/github/stars/jdsherbert/Anime-Tracker?label=%E2%AD%90"/>
<img align="right" alt="Forks Badge" src="https://img.shields.io/github/forks/jdsherbert/Anime-Tracker?label=%F0%9F%8D%B4"/>
<img align="right" alt="Watchers Badge" src="https://img.shields.io/github/watchers/jdsherbert/Anime-Tracker?label=%F0%9F%91%81%EF%B8%8F"/>
<img align="right" alt="Issues Badge" src="https://img.shields.io/github/issues/jdsherbert/Anime-Tracker?label=%E2%9A%A0%EF%B8%8F"/>
<a href = "https://developer.mozilla.org/en-US/docs/Web/HTML"> <img height="40" img width="40" src="https://cdn.simpleicons.org/html5"> </a>
<a href = "https://developer.mozilla.org/en-US/docs/Web/CSS"> <img height="40" img width="40" src="https://cdn.simpleicons.org/css"> </a>
<a href = "https://developer.mozilla.org/en-US/docs/Web/JavaScript"> <img height="40" img width="40" src="https://cdn.simpleicons.org/javascript"> </a>
<!-- Header End --> 

-----------------------------------------------------------------------

<a href="https://web.dev/explore/progressive-web-apps"> 
  <img align="left" alt="Progressive Web App" src="https://img.shields.io/badge/Progressive%20Web%20App-black?style=for-the-badge&logo=pwa&logoColor=white&color=black&labelColor=black"> </a>
  
<a href="https://choosealicense.com/licenses/unlicense/"> 
  <img align="right" alt="License" src="https://img.shields.io/badge/License%20:%20Unlicense-black?style=for-the-badge&logo=unlicense&logoColor=white&color=black&labelColor=black"> </a>
  
<br></br>

-----------------------------------------------------------------------
## Overview
Page: https://jdsherbert.github.io/Anime-Tracker/

An ad-free anime tracker that installs to your phone's home screen. Sort shows into **Watching**, **To Watch** and **Completed**, tap **+1** after each episode, and give them a score and notes.

- Search uses the free [AniList API](https://docs.anilist.co/) for titles, cover art and episode counts.
- Everything is stored on the device (`localStorage`). No account, no server.
- Works offline once installed. Covers you've already seen are cached.
- Back up and restore from **⋮ → Export / Import backup**.

## Running locally
It's plain HTML/CSS/JS with no build step. Serve the folder over HTTP (service workers don't run from `file://`):

```sh
npx serve .
```

## Making changes
- Bump `VERSION` in `sw.js` when shipping changes. The app checks for new files whenever it's opened online, so this mainly clears out stale caches.
- Tabs and statuses are defined in `STATUSES` at the top of `app.js`.
- Colours are CSS variables at the top of `styles.css`.
- Regenerate icons with `node tools/make-icons.mjs`.


-----------------------------------------------------------------------

