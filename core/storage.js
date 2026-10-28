'use strict';
const TEST_PREFIX='doclib-test-v137:';
const testStorage={getItem:k=>localStorage.getItem(TEST_PREFIX+k),setItem:(k,v)=>localStorage.setItem(TEST_PREFIX+k,v),removeItem:k=>localStorage.removeItem(TEST_PREFIX+k),key:i=>Object.keys(localStorage).filter(k=>k.startsWith(TEST_PREFIX)).map(k=>k.slice(TEST_PREFIX.length))[i]??null,get length(){return Object.keys(localStorage).filter(k=>k.startsWith(TEST_PREFIX)).length}};
// Keep the v137 namespace intentionally to preserve existing TEST profiles and links.
