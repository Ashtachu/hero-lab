const fs=require('node:fs');const vm=require('node:vm');
const html=fs.readFileSync('site/index.html','utf8');let count=0;
for(const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)){new vm.Script(match[1]);count++;}
if(count<3)throw new Error('Missing expected application scripts');
if(!html.includes('id="power-results"'))throw new Error('Power tools missing');
if(!html.includes('id="hero-follow-trigger"'))throw new Error('Hero follow control missing');
console.log(`Validated ${count} JS blocks and key live patch controls`);
