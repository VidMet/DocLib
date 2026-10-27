'use strict';
const testNativeFetch=window.fetch.bind(window);
window.fetch=(input,options={})=>{const method=String(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();if(!['GET','HEAD'].includes(method))return Promise.reject(Error('TEST: nettverksskriving er sperret i preview.3.'));return testNativeFetch(input,options)};

