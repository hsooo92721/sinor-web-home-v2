import {EditorView,EditorState,Prec,openSearchPanel,search,basicSetup,keymap,indentUnit,indentWithTab,html,css,oneDark,formatHtml,formatCss} from '../assets/vendor/code-editor/editor.js?v=3';
import {el,button} from './forms-ui.js?v=1';
export async function footerCodeEditor(host,value,language,onChange){
 const format=language==='css'?formatCss:formatHtml;
 try{value=await format(value)}catch{}
 if(!host.isConnected)return null;
 const area=el('div',{class:'footer-code-area'}),status=el('span',{class:'footer-code-status',role:'status'});
 let view,busy=false;
 const tidy=async()=>{if(busy)return;busy=true;try{const before=view.state.doc.toString(),after=await format(before);if(view.state.doc.toString()===before)view.dispatch({changes:{from:0,to:view.state.doc.length,insert:after}});status.textContent='코드를 정리했습니다.'}catch{status.textContent='문법을 확인해 주세요. 입력한 코드는 유지됩니다.'}finally{busy=false}};
 const toolbar=el('div',{class:'footer-code-toolbar'},el('strong',{},language.toUpperCase()),el('div',{class:'actions'},status,button('검색',()=>{openSearchPanel(view);},'button small'),button('코드 정리',tidy,'button small')));host.append(toolbar,area);
 const theme=EditorView.theme({'&':{fontSize:'14px',minHeight:'420px',maxHeight:'680px',width:'100%',backgroundColor:'#151b26'},'.cm-scroller':{overflowX:'hidden',overflowY:'auto',lineHeight:'24px',fontFamily:'ui-monospace,SFMono-Regular,Consolas,monospace'},'.cm-content':{padding:'14px 0',minWidth:'0',caretColor:'#fff'},'.cm-line':{padding:'0 16px',overflowWrap:'anywhere',wordBreak:'break-word'},'.cm-gutters':{backgroundColor:'#192230',color:'#78899f',borderRight:'1px solid #2b3647'},'&.cm-focused':{outline:'none'},'.cm-panels-top':{position:'absolute',top:'0',right:'0',left:'auto',zIndex:'10',maxWidth:'100%',border:'1px solid #455369',borderRadius:'0 0 0 8px',boxShadow:'0 4px 16px #0004'},'.cm-search':{padding:'8px 28px 8px 10px',maxWidth:'480px',whiteSpace:'normal'},'.cm-search input':{maxWidth:'160px',boxSizing:'border-box'},'.cm-search button':{fontSize:'12px'}});
 view=new EditorView({parent:area,state:EditorState.create({doc:value,extensions:[basicSetup,search({top:true}),Prec.highest(keymap.of([{key:'Mod-f',run:openSearchPanel,preventDefault:true},{key:'Ctrl-f',run:openSearchPanel,preventDefault:true}])),EditorView.lineWrapping,language==='css'?css():html({autoCloseTags:true}),oneDark,theme,indentUnit.of('  '),EditorState.tabSize.of(2),keymap.of([{key:'Alt-Shift-f',run:()=>{tidy();return true}},indentWithTab]),EditorView.contentAttributes.of({'aria-label':'공통 푸터 '+language.toUpperCase(),spellcheck:'false'}),EditorView.updateListener.of(update=>{if(update.docChanged)onChange(update.state.doc.toString())})]})});
 return {destroy:()=>view.destroy()};
}

export async function formatFooterSource(source){return {...source,html:await formatHtml(source.html),css:await formatCss(source.css)}}
