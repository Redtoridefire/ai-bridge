'use strict';
function scriptFor(provider, action, text, scope, expectedOrigin) {
  const guard=`if(location.origin!==${JSON.stringify(expectedOrigin)})throw new Error('Provider origin changed.');`;
  if(action==='extract')return `(function(){${guard}
    if(${JSON.stringify(scope)}==='selection')return String(window.getSelection()).slice(0,120000);
    const us=${JSON.stringify(provider.selectors.user)},as=${JSON.stringify(provider.selectors.assistant)};
    if(!us.length&&!as.length)return '';
    const seen=[],rows=[];
    for(const node of document.querySelectorAll(us.concat(as).join(','))){if(seen.some(parent=>parent.contains(node)))continue;seen.push(node);const text=(node.innerText||'').trim();if(text)rows.push((us.some(s=>node.matches(s))?'USER':'ASSISTANT')+':\\n'+text);}
    return rows.join('\\n\\n').slice(-120000);
  })()`;
  return `(function(){${guard}
    let target=null;for(const selector of ${JSON.stringify(provider.selectors.composer)}){const matches=[...document.querySelectorAll(selector)].filter(el=>el.getClientRects().length);if(matches.length){target=matches.at(-1);break;}}
    if(!target)return 'NO_INPUT';const value=${JSON.stringify(text)};target.focus();
    if(target.tagName==='TEXTAREA'||target.tagName==='INPUT'){const setter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target),'value')?.set;if(setter)setter.call(target,value);else target.value=value;target.dispatchEvent(new Event('input',{bubbles:true}));}
    else{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(target);selection.removeAllRanges();selection.addRange(range);document.execCommand('insertText',false,value);target.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:value}));}
    return 'PREPARED';
  })()`;
}
module.exports={scriptFor};
