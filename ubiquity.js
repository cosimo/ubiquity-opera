//
// Ubiquity for Opera? A nightly experiment...
// -------------------------------------------
//
// An attempt to rewrite Firefox's Ubiquity extension
// for Opera using UserJS.
//
// Original Ubiquity Project: http://labs.mozilla.org/ubiquity/
//
// To use this in Opera, you need to:
//
// * Enable UserJS. Point your browser to opera:config#Javascript and:
//
//  - tick "User Javascript" checkbox
//  - type the folder you want to run the scripts from
//    in the "User Javascript File" textfield
//
//  If you want, you can also allow UserJS execution in
//  HTTPS pages.
//
// * Remove the default shortcut key bound to CTRL + SPACE,
//   since the original Ubiquity is activated and deactivated
//   with CTRL + SPACE.
//
// Have fun!
//
// ----------------------------------------------
// Cosimo Streppone, <cosimo@opera.com>
// First version: 19/01/2009
// ----------------------------------------------
//
// Includes a-lib-stacktrace.js and a-lib-xmlhttp-cd.js
// Copyright © 2007 by João Eiras.
// ----------------------------------------------
//
// $Id$

;

// -------------------------------------
// ==UserScript==
// @name Stack Trace getter
// @author Joao Eiras
// @ujs:modified 2007-04-11
// ==/UserScript==
// -------------------------------------

(function(opera) {

    if (!opera) return;

	//caching native functions - overriding these can make the script
	//break, which therefore can't be trusted for security
	var RegExp_test = RegExp.prototype.test;
	var RegExp_exec = RegExp.prototype.exec;
	var String_split = String.prototype.split;
	var Function_call = Function.prototype.call;
	
	function extend(object,fields_src){
		for(var prop in fields_src){
			try{
				object[prop] = fields_src[prop];
			}catch(ex){}
		}
		return object;
	};
	
	//types of places where scripts run
	var scriptTypes = {
		UNKNOWN : 0,
		INLINE : 1,
		LINKED : 2,
		USERJS : 3,
		EVAL : 4
	};
	
	function scriptTypeToString(t){
		switch(t){
			case scriptTypes.INLINE :return 'inline script';
			case scriptTypes.LINKED :return 'linked script';
			case scriptTypes.USERJS :return 'UserJS';
			case scriptTypes.EVAL   :return 'eval';
			case scriptTypes.UNKNOWN:return 'unknown';
		}
		return t;
	};
	
	function StackTrace(){
		extend(this,[]);//in case of prototype editing...Array.prototype can change though
		
		//using this.fname = function(){} is safer that prototype, because
		//this way methods in the prototype aren't overriden
		this.toString = function(){
			var s='';
			for(var k=0; k<this.length; k++)
				s += this[k].toString('\t')+',\n';
			return '[object StackTrace]{\n'+s.substring(0,s.length-2)+'\n}';
		};
		this.toSmallString = function(){
			var s='';
			for(var k=0; k<this.length; k++)
				s += this[k].toSmallString('\t')+',\n';
			return '{\n'+s.substring(0,s.length-2)+'\n}';
		};
		this.UserJsOnly = function(){
			//yes eval can be called from userjs, but it can too be called from a page script, and it's not detectable
			//and eval can easily be workarounded
			//the last element is skipped because it's always unknown when functions are called by the event dispatcher
			//a regular page can too set up a event listener, but it can't wrap the function call
			for(var k=0; k<this.length; k++){
				if( k == (this.length - 1) )//for timers, event listeners or address bar
					if( this[k].type == scriptTypes.UNKNOWN )
						return true;
				if( this[k].type != scriptTypes.USERJS )
					return false;
			}
			return true;
		};
	};
	//[] indexing operator can only be copied this way
	StackTrace.prototype = [];
		
	function StackTraceElement(line,type,src,expr){ 
		this.lineno = line||0;
		this.type = type||scriptTypes.UNKNOWN;
		this.src = src||'';
		this.expression = expr||'';
		
		this.typeToString=function(t){
			return scriptTypeToString(t||this.type);
		};
		this.toString = function(pad){
			if( typeof pad == 'undefined' )
				pad ='';
			return	pad+'[object StackTraceElement]{\n'+
					pad+'\tLine '+this.lineno+'\n'+
					pad+'\tType '+this.typeToString()+'\n'+
					pad+'\tUrl: '+(this.src||'unknown location')+'\n'+
					pad+'\tExpression: \n\t\t'+this.expression+'\n'+
					pad+'}';
		};
		this.toSmallString = function(){
				return this.type == scriptTypes.UNKNOWN?
					'"'+this.expression+'" at unknown location':
					'"'+this.expression+'" at line '+this.lineno+' of '+this.typeToString()+' at '+(this.src||'unknown location');
		};
		//make constants accessible inside a instance
		extend(this,scriptTypes);
	};
	//make constants public
	extend(StackTraceElement,scriptTypes);
	StackTraceElement.typeToString = scriptTypeToString;
	
	var addUnknown = false;
	function getStackTrace(exception,prevStackTrace){
		RegExp_exec.call = RegExp_test.call = String_split.call = Function_call;
		
		function trim(s){ return (typeof s=='string')?s.replace(/^\s+/,'').replace(/\s+$/,''):s; }
		function clean(s){ return (typeof s=='string')?s.replace(/\s+/g,' '):s; }
		
		var skip = 0;
		if( arguments.length==0 )
			try{
				undefined()();
			}catch(ex){
				exception = ex;
				skip=2;
			}
		else if( !(exception instanceof Error) )
			return ['ERROR: wrong object type passed to opera.getStackTrace. Exception required'];
				
		var line_re = /\s*Line (\d+) of (User JS|inline#\d+|linked|eval|unknown) script( in)? (.*)?/;
		var unk_re = /At unknown location/;
		
		var parts = String_split.call(trim(exception.message), '\n');
		var str = new StackTrace();
		for(var k=2;k<parts.length;k++){
			if( RegExp_test.call(unk_re, parts[k]) ){
				//push can't be used...
				if( addUnknown )
					str[str.length++] = new StackTraceElement(0,scriptTypes.UNKNOWN,'',trim(parts[++k]).replace(/^\[(.*)\]$/,'$1'));
				else k++;
				continue;
			}
			if( !RegExp_exec.call(line_re, parts[k]) )
				continue;
			
			if( skip ){ skip--; continue; }
			var lineno = parseInt(RegExp.$1);
			var stype = RegExp.$2;
			var url = RegExp.$4||RegExp.$3;
			
			var expression = '';
			
			for(var m=k+1;m<parts.length && !RegExp_test.call(line_re, parts[m]) && !RegExp_test.call(unk_re, parts[m]);m++){
				expression += parts[m];
			}
			expression = clean(expression);
	
			if( stype=='User JS' ) stype = scriptTypes.USERJS;
			else if( stype.substring(0,6)=='inline' ) stype = scriptTypes.INLINE;
			else if( stype=='linked' ) stype = scriptTypes.LINKED;
			else if( stype=='eval' ) stype = scriptTypes.EVAL;
			else if( stype=='unknown' ) stype = scriptTypes.UNKNOWN;
			else stype = scriptTypes.UNKNOWN;
			//alert(str.length+' '+str[str.length]);
			
			if( stype != scriptTypes.UNKNOWN || addUnknown ){
				str[str.length++] = new StackTraceElement(lineno,stype,url,expression);
			}
			//str.length++;
			k=m-1;
		}
		if(prevStackTrace && prevStackTrace instanceof StackTrace){
			for(var k=0;str[k];k++)
				prevStackTrace[prevStackTrace.length++] = str[k];
			return prevStackTrace;
		}
		return str;
	}
	
	opera.getStackTrace = getStackTrace;

}) (window.opera);

// -------------------------------------
// ==UserScript==
// @name Cross-domain XMLHttpRequest
// @author Joao Eiras
// @ujs:modified 2009-10-01
// ==/UserScript==
// -------------------------------------

(function(window, opera, document, dom_implementation) {

    if (!opera) return;

    /*

        Cross domain XMLHttpRequest implementation for Opera

    */
	var commonToken = "opera.XMLHttp.";
	var crossDocRequest = commonToken+"Request.";
	var crossDocResponse = commonToken+"Response.";
	var acknowledge = commonToken+"acknowledge.";
	var urlToken = "#opera-XMLHttp-tk-";
	var location = window.location;

	//all user js run once before any page script, therefore this is executed, all 
	//opera.* functions and properties are the original ones, and not probable values
	//overridden by the current page
	var Function_call = Function.prototype.call;
	var setTimeout = window.setTimeout;
	var setInterval = window.setInterval;
	var clearInterval = window.clearInterval;
	var parseInt = window.parseInt;
	var postMessage = window.postMessage || window.document.postMessage;
	var opera_addEventListener = opera.addEventListener;
	var window_addEventListener = window.addEventListener;
	var opera_getStackTrace = opera.getStackTrace;
	var String_match = String.prototype.match;
	var String_replace = String.prototype.replace;
	var String_split = String.prototype.split;
	var String_substring = String.prototype.substring;
	var String_toLowerCase = String.prototype.toLowerCase;
	var String_toUpperCase = String.prototype.toUpperCase;
	var Array_push = Array.prototype.push;
	var Array_join = Array.prototype.join;
	var Array_splice = Array.prototype.splice;
	var Document_createDocumentFragment = Document.prototype.createDocumentFragment;
	var Document_createElement = Document.prototype.createElement;
	var Document_createElementNS = Document.prototype.createElementNS;
	var Document_createDocument = document.implementation.createDocument;
	var DOMParser = window.DOMParser;
	var DOMParser_parseFromString = DOMParser.prototype?DOMParser.prototype.parseFromString:new DOMParser().parseFromString;
	var escape = window.escape;
	var encodeURIComponent = window.encodeURIComponent;
	var unescape = window.unescape;
	var XMLHttpRequest = window.XMLHttpRequest;
	var XMLHttpRequest_abort = XMLHttpRequest.prototype.abort;
	var XMLHttpRequest_open = XMLHttpRequest.prototype.open;
	var XMLHttpRequest_send = XMLHttpRequest.prototype.send;
	var XMLHttpRequest_setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
	var XMLHttpRequest_getResponseHeader = XMLHttpRequest.prototype.getResponseHeader;
	var XMLHttpRequest_getAllResponseHeaders = XMLHttpRequest.prototype.getAllResponseHeaders;
	var Event_preventDefault = Event.prototype.preventDefault
	var RegExp = window.RegExp;
	var RegExp_exec = RegExp.prototype.exec;
	var Math = window.Math;
	var Math_abs = Math.abs;
	var Math_random = Math.random;
	var Date = window.Date;
	var Date_getTime = Date.prototype.getTime;
	var Node_appendChild = Node.prototype.appendChild;
	var Node_removeChild = Node.prototype.removeChild;
	
	var DOMLoadedEventType = (opera.version() >= 9 ? 'DOMContentLoaded' : 'load');
	var documentLoaded = false;
	window_addEventListener.call(window,DOMLoadedEventType,function(){ documentLoaded = true; },false);
	var iskestrelup = (window.opera&&opera.version()>=9.5);
	
	function resetFunctionsCall(){
		setTimeout.call = parseInt.call = postMessage.call = opera_addEventListener.call =
		window_addEventListener.call = String_match.call = String_replace.call = String_split.call = 
		String_substring.call = String_toLowerCase.call = String_toUpperCase.call = Array_push.call =
		Array_join.call = Array_splice.call = Document_createDocumentFragment.call =
		Document_createElement.call = Document_createElementNS.call = DOMParser_parseFromString.call =
		XMLHttpRequest_abort.call =	XMLHttpRequest_open.call = XMLHttpRequest_send.call =
		XMLHttpRequest_setRequestHeader.call = XMLHttpRequest_getResponseHeader.call = 
		XMLHttpRequest_getAllResponseHeaders.call = Event_preventDefault.call = RegExp_exec.call = 
		Math_abs.call = Math_random.call = Date_getTime.call = Node_appendChild.call = Node_removeChild.call = 
		Function_call;
	};
	function _throw(ex){
		setTimeout(function(){ throw ex; },1);
	}
	function callWrapped(obj,fn){
		if( typeof obj[fn] == 'function' )
			try{ return obj[fn](); }catch(ex){ _throw(ex); }
	}
	function parseDOM(markup,useDocument){
		if(!markup)
			return Document_createDocument.call(dom_implementation,null,null,null);
		try{
			markup = trimString(markup);
			var nd = DOMParser_parseFromString.call(new DOMParser(),
				(String_match.call(markup,/<!\s*doctype\b/i)?'':
				'<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">')
				+markup,'text/xml');
			return useDocument?nd:nd.documentElement;//doctype for entities
		}catch(ex){
			try{
				var frag = Document_createDocumentFragment.call(document);
				var d = Document_createElement.call(document, String_match.call(markup,/<(\w+)\b/) ? RegExp.$1: 'html');
				if( typeof d.innerHTML == 'undefined' )
					return null;
				d.innerHTML = markup;
				if( !useDocument ){ return d; }
				var doc = Document_createDocument.call(dom_implementation,null,null,null);
				doc.appendChild(d);
				return doc;
			}catch(ex){
				return null;
			}
		}
	}
	function trimString(str){
		return String_replace.call(String_replace.call(str, /^\s+/,''),/\s+$/,'');
	}
	function serializeRequestHeaders(hdrs){
		var s = '';
		for(var k=0; k<hdrs.length; k++)//cookie style :) ';' is escaped too - great
			s += escape(hdrs[k].name)+'='+escape(hdrs[k].value)+';';
		return s;
	}
	function deSerializeRequestHeaders(hdrs){
		var all = String_split.call(hdrs,';'), ret=[];
		for(var k=0; k<all.length; k++){
			var crumbs = String_split.call(all[k],'=');
			if(crumbs.length==2)
				Array_push.call(ret,{name:unescape(crumbs[0]),value:unescape(crumbs[1])});
		}
		return ret;
	}
	function getAllXMLHttpHeaders( xmlhttp ){
		var allHeaders = '', ret = [];
		try{
			allHeaders = String_split.call(XMLHttpRequest_getAllResponseHeaders.call(xmlhttp),'\n');
		}catch(ex){}
		
		for(var k=0; k<allHeaders.length; k++){
			var crumbs = String_split.call(allHeaders[k],':');
			if(crumbs.length>=2){
				Array_push.call(ret,{name:trimString(crumbs[0]),
					value:trimString(Array_join.call(Array_splice.call(crumbs,1,crumbs.length-1),':'))});
				//,toString:function(){return '['+this.name+','+this.value+']\n';}
			}
		}
		return ret;
	}
	function checkScriptRights(){
		//tells if current executing script can use cross domain XMLHttp
		if( !opera_getStackTrace )
			throw new Error("opera.StackTrace module required for opera.XMLHttpRequest module");
			
		if( !opera_getStackTrace().UserJsOnly() )
			throw new Error("Security violation - user scripts only");
	}
	function cleanCurrentPage(){
		opera_addEventListener.call(opera,"BeforeExternalScript",function(ejs){resetFunctionsCall();Event_preventDefault.call(ejs);},false);
		opera_addEventListener.call(opera,"BeforeScript",function(ejs){resetFunctionsCall();Event_preventDefault.call(ejs);},false);
		opera_addEventListener.call(opera,"BeforeEventListener",function(ejs){resetFunctionsCall();Event_preventDefault.call(ejs);},false);
		opera_addEventListener.call(opera,"BeforeJavascriptURL",function(ejs){resetFunctionsCall();Event_preventDefault.call(ejs);},false);
		
		function doCleaning(){
			resetFunctionsCall();
			while( document.documentElement.firstChild )
				Node_removeChild.call(document.documentElement, document.documentElement.firstChild );
		}
		
		if( documentLoaded )
			doCleaning();
		else{
			if( opera.version() >= 9 ){
				window_addEventListener.call(window,DOMLoadedEventType,doCleaning,false);
			}
			else{
				var clean_n_calls = 0;
				var clean_interval;
				var clean_f = function(){
				
					doCleaning();
					
					clean_n_calls++;
					if( clean_n_calls == 20 )//10 seconds
						clearInterval(clean_interval);
				}
				clean_interval = setInterval(clean_f,500); 
				window_addEventListener.call(window,DOMLoadedEventType,function(){clean_f();clearInterval(clean_interval);},false);
			}
		}
	}
	function resolveUrl(url){
		var a=Document_createElementNS.call(document,'http://www.w3.org/1999/xhtml','a');
		a.href=url;
		return a.href;
	}
	
	var dummyRequest = new XMLHttpRequest();
	function copyXMLHttpObjProperties(src,dest){
		for(var prop in src)
			if( !(prop in dummyRequest) || String_substring.call(prop,0,2)=='on' )
				dest[prop] = src[prop];
	}
			
	//the fetching iframe
	if( ts = RegExp_exec.call(new RegExp( urlToken+"(\\d+)$" ), location.href ) ){
		cleanCurrentPage();
		
		var ts = parseInt(ts[1]);

		function filterExcept(obj,prop){
			try{
				return obj[prop];
			}catch(ex){
				return undefined;
			}
		}
		opera_addEventListener.call(opera,'BeforeEvent.message',function(ev){
			resetFunctionsCall();
		
			if( !ev.event.data ){ return; }
			var data = String_split.call(ev.event.data, '\n');
			if( data[0]!=(crossDocRequest+ts) ){ return; }
			Event_preventDefault.call(ev);
			
			
			var method = data[1];
			var url = data[2];
			var username = data[3];
			var password = data[4];
			var postArgs = unescape(data[5]);
			var reqHeaders = deSerializeRequestHeaders(data[6]);
			
			var xmlhttp = new XMLHttpRequest();
			var evsource = ev.event.source;
			xmlhttp.onreadystatechange=function(){
				resetFunctionsCall();
				if( this.readyState >1 )
					postMessage.call( evsource,
						crossDocResponse+ts+'\n'+
						this.readyState+'\n'+
						escape(filterExcept(this,'responseText'))+'\n'+
						filterExcept(this,'status')+'\n'+
						filterExcept(this,'statusText')+'\n'+
						serializeRequestHeaders(getAllXMLHttpHeaders( this ))
					);
			};
			
			if(username&&password)
				XMLHttpRequest_open.call(xmlhttp,method,url,false,username,password);
			else
				XMLHttpRequest_open.call(xmlhttp,method,url,false);
			for(var k=0; k<reqHeaders.length; k++)
				try{
					XMLHttpRequest_setRequestHeader.call(xmlhttp,reqHeaders[k].name,reqHeaders[k].value);
				}catch(ex){}
			
			try{
				XMLHttpRequest_send.call(xmlhttp, postArgs);
			}catch(ex){
				postMessage.call( evsource, crossDocResponse+ts+'\nERROR\n'+ex.message );
			}
			
		},false);
		
		var target = iskestrelup ? window.parent : window.parent.document;
		postMessage.call( target, acknowledge+ts );
		
	}
	else{		
		
		//holds the data needed for the beforevent.message listener
		var allRequestsData = {};
		var precompRE = {
			//req:new RegExp(crossDocRequest+"(\\d+)"),
			res:new RegExp("^"+crossDocResponse.replace(/\./g,'\.')+"(\\d+)"),
			ack:new RegExp("^"+acknowledge.replace(/\./g,'\.')+"(\\d+)")
		};
		opera_addEventListener.call(opera,'BeforeEvent.message',function(ev){
			if( !ev.event.data )
				return;
			resetFunctionsCall();
			
			if( String_match.call(ev.event.data, precompRE.res ) ){
				Event_preventDefault.call(ev);
				var ts = parseInt(RegExp.$1);
				allRequestsData[ts].getResponseListener(ev.event);
			}
			else if( String_match.call(ev.event.data, precompRE.ack ) ){
				Event_preventDefault.call(ev);
				var ts = parseInt(RegExp.$1);
				allRequestsData[ts].acknowledgeListener(ev.event);
			}
			else{return;}
				
	
		},false);
		
		function XMLHttpRequestCD(){
			checkScriptRights();
			resetFunctionsCall();
			
			
			//unique random number to filter messages
			var ts = Math_abs.call(Math,Date_getTime.call(new Date()) ^ (Math_random.call(Math)*0x7fffffff|0) );
			var request = new XMLHttpRequest();
			var requestHeaders = [];
			var responseHeaders = [];
			var requestAborted = false;
			var uri,hostname,port,protocol,username,password,method;
			var sent = false;
			var this_xmlhttp = this;
			var ifr = null;
			
			allRequestsData[ts] = {};
			this.toString = function(){ return "[object opera.XMLHttpRequest]"; }
		
			function isCrossDomain(){
				return	location.hostname!=hostname ||
						location.port    !=port     ||
						location.protocol!=protocol;
			}
			
			this.timeout = 10000;//msec
			this.ontimeout = null;
			this.onreadystatechange = null;
			this.onload = null;
			
			this.open = function(p_method, p_uri, p_asyncFlag, p_username, p_password){
				checkScriptRights();
				resetFunctionsCall();
				
				requestAborted = false;
				protocol = "http:";
				hostname = "";
				port = "";
				method = p_method||'';
				uri = resolveUrl(p_uri||'');
				username = p_username||'';
				password = p_password||'';
				
				if( uri.match(/^((\w+:)\/\/?([^\/:]+)(:(\d+))?)\/(.*)$/) ){
					protocol = RegExp.$2;
					hostname = RegExp.$3;
					port = RegExp.$5||"";
					path = '/'+RegExp.$6;
				}else{
					throw new Error("URI resolution failed or unknown");
				}
				
				if( !isCrossDomain() ){
					copyXMLHttpObjProperties(this,request);
					if(username&&password)
						return XMLHttpRequest_open.call(request, method, uri, p_asyncFlag, username, password);
					else
						return XMLHttpRequest_open.call(request, method, uri, p_asyncFlag);
				}
				else{
					this_xmlhttp.readyState = 1;
					this_xmlhttp.status = 0;
					this_xmlhttp.statusText = '';
					this_xmlhttp.responseText = '';
					this_xmlhttp.responseXML = null;
					callWrapped(this_xmlhttp, 'onreadystatechange');
				}
			}
		
			this.setRequestHeader = function(hdr, val){ 
				checkScriptRights();
				resetFunctionsCall();
				
				if( !isCrossDomain() ){
					return XMLHttpRequest_setRequestHeader.call(request, hdr, val);
				};
				if( sent ){
					throw new Error("INVALID_STATE_ERR: setRequestHeader()");
				}else{
					for(var k=0; k<requestHeaders.length ;k++)
						if( String_toLowerCase.call(requestHeaders[k].name) == String_toLowerCase.call(''+hdr) ){
							requestHeaders[k].value = val;
							return;
						}
					Array_push.call(requestHeaders,{name:hdr,value:val});
				};
			};
			
			this.getResponseHeader = function(hdr){
				checkScriptRights();
				resetFunctionsCall();
				
				if( !isCrossDomain() ){
					return XMLHttpRequest_getResponseHeader.call(request,hdr);
				};
				if( sent && this.readyState > 2 ){
						
					for(var k=0; k<responseHeaders.length ;k++)
						if( String_toLowerCase.call(responseHeaders[k].name) == String_toLowerCase.call(''+hdr) )
							return responseHeaders[k].value;
					return null;
					
				}else{
					throw new Error("INVALID_STATE_ERR: getResponseHeader()");
				};
			};
		
			var opr_getAllResponseHeaders = this.getAllResponseHeaders = function(){ 
				checkScriptRights();
				resetFunctionsCall();
				
				if( !isCrossDomain() ){
					return XMLHttpRequest_getAllResponseHeaders.call(request);
				};
				if( sent && this.readyState > 2 ){
						
					var s = '';
					for(var k=0; k<responseHeaders.length ;k++)
						s += responseHeaders[k].name+': '+responseHeaders[k].value+'\n';
					return s;
				}else{
					throw new Error("INVALID_STATE_ERR: XHR::getAllResponseHeaders()");
				};
			};
			
			allRequestsData[ts].getResponseListener = function(ev){
				function u(o){ return o == 'undefined' ? undefined : o; }
				
				var data = String_split.call(ev.data,'\n');
				
				if( requestAborted )
					return;
					
				if( data.length==3 && data[1]=='ERROR' ){ throw data[2]; return; }
				
				this_xmlhttp.readyState = parseInt(data[1]);
				this_xmlhttp.responseText = this_xmlhttp.readyState<3?'':unescape(data[2]);
				try{
					if( this_xmlhttp.readyState<4 ){
						this_xmlhttp.responseXML = null;
					}
					else{
						this_xmlhttp.responseXML = parseDOM(this_xmlhttp.responseText,true);
						if( !this_xmlhttp.responseXML ){
							if(ifr)ifr.location.href = 'data:text/html,'+encodeURIComponent(this_xmlhttp.responseText);
							this_xmlhttp.responseXML = ifr.contentDocument;
						}
					}
				}catch(ex){
					this_xmlhttp.responseXML = null;
				}
				
				this_xmlhttp.status = parseInt(u(data[3])||0);
				this_xmlhttp.statusText = u(data[4])||'';
				
				responseHeaders = deSerializeRequestHeaders(data[5]);
				sent = true

				callWrapped( this_xmlhttp, 'onreadystatechange' );
				if( this_xmlhttp.readyState == 4 ){
					callWrapped( this_xmlhttp, 'onload' );
					if(ifr)ifr.style.display = 'none';
				};
			};
			
			this.abort = function(){
				checkScriptRights();
				resetFunctionsCall();
				
				if( isCrossDomain() ){
					requestAborted = true;
				}
				else{
					XMLHttpRequest_abort.call(request);
				};
			};
			
			this.send = function(args){
				checkScriptRights();
				resetFunctionsCall();
				
				if( !isCrossDomain() ){
					copyXMLHttpObjProperties(this,request);
					return XMLHttpRequest_send.call(request,args);
				}
				
				if( protocol != 'http:' && protocol != 'https:' )
					throw new Error("Unsupported protocol");
				
				var canTimeout = true;
				var self = this;
				allRequestsData[ts].acknowledgeListener = function(ev){
					canTimeout = false;
					opr_getAllResponseHeaders.call = Function_call;
					postMessage.call( ev.source,
						crossDocRequest+ts+'\n'+method+'\n'+uri+'\n'+
						username+'\n'+password+'\n'+escape(args||'')+'\n'+
						serializeRequestHeaders( requestHeaders )
					);
				}

				function sendRequest(){
					resetFunctionsCall();

					//these actions need the document to be able to append nodes
					var ifr = parseDOM('<iframe xmlns="http://www.w3.org/1999/xhtml" '+
						'frameborder="0" style="width:0px;height:0px;visibility:hidden;position:absolute;left:-999em;"></iframe>');
					Node_appendChild.call(document.body||document.documentElement,ifr);
					ifr.src = uri+urlToken+ts;
					setTimeout(function(){
						if( canTimeout )
							callWrapped( this_xmlhttp, 'ontimeout' );
					},this_xmlhttp.timeout||10000);
				}
				if( documentLoaded )
					sendRequest();
				else
					window_addEventListener.call(window,DOMLoadedEventType,sendRequest,false);
			};
		}
		
		opera.XMLHttpRequest = XMLHttpRequestCD;
	}

}) (window, window.opera, document, document.implementation);

//
// Ubuiquity.js
//

(function (opera) {
    if (! opera) return;

    // -----------------------------------------------
    //
    //       Firefox Ubiquity emulation layer
    //
    // -----------------------------------------------

    //
    // CmdUtils
    //

    if (CmdUtils == undefined) var CmdUtils = {}
    noun_arb_text = 1;
    CmdUtils.VERSION = 0.01;
    CmdUtils.CommandList = new Array ();
    CmdUtils.CreateCommand = function CreateCommand (args) {
        var cmd_name = args['name'];
        var cmd_list = CmdUtils.CommandList;
        if (cmd_name in cmd_list) {
            return;
        }
        CmdUtils.CommandList.push(args);
    }
    CmdUtils.closeWindow = function closeWindow () { CmdUtils.getWindow().close(); }
    CmdUtils.getDocument = function getDocument () { return document; }
    CmdUtils.getLocation = function getLocation () { return CmdUtils.getDocument().location; }
    CmdUtils.getWindow = function getWindow () { return window; }
    CmdUtils.openWindow = function openWindow (url,name) {
        if (!name) {
            CmdUtils.getWindow().open(url);
        } else {
            CmdUtils.getWindow().open(url, name);
        }
    }
    // 2nd order function
    CmdUtils.SimpleUrlBasedCommand = function SimpleUrlBasedCommand (url) {
        if (! url) return;
        var search_func = function (directObj) {
            if (! directObj) return;
            var text = directObj.text;
            text = encodeURIComponent(text);
            url = url.replace('{text}', text);
            url = url.replace('{location}', CmdUtils.getLocation());
            CmdUtils.toggleUbiquityWindow();
            Utils.openUrlInBrowser(url);
        };
        return search_func;
    }
    CmdUtils.toggleUbiquityWindow = function toggleUbiquityWindow (w) {
        if (!w) w = ubiq_window;
        var vis = w.style.visibility;
        if (vis=='hidden') vis='visible' else vis='hidden';
        w.style.visibility=vis;
        return;
    }

    //
    // Utils
    //
    if (Utils==undefined) var Utils = {}
    Utils.openUrlInBrowser = function(url) {
        window.open(url);
    };

    //
    // Application
    //
    if (Application==undefined) var Application = {
        activeWindow: {
            activeTab: window
        }
    }

    var ubiq_window;
    var ubiq_selection;
    var ubiq_element;
    var ubiq_remote_server = 'http://people.opera.com/cosimo/ubiquity';
    var ubiq_selected_command;
    var ubiq_first_match;

    // Used to get css url of images and other resources
    function ubiq_url_for (path) {
        var url = 'url(';
        url += ubiq_remote_server;
        url += '/';
        url += path;
        url += ')';
        return url;
    }

    function ubiq_create_window () {
        var doc = window.document;
        var wnd = document.createElement('div');
        var stl = wnd.style;
        wnd.setAttribute('id', 'ubiq_window');
        stl.position='fixed';
        stl.left=1;
        stl.top=1;
        stl.visibility='hidden';
        stl.width='810px';
        stl.height='561px';
        stl.border='0';
        stl.padding='0';
        // Our window should appear on top of everything 
        stl.zIndex='99999';
        stl.background = ubiq_url_for('ubiq_background.png');
        wnd.innerHTML = ubiq_start_mode();
        doc.body.appendChild(wnd);
        return wnd;
    }

    function ubiq_start_mode () {
        var input_style =
               'border:0; padding:0; height:32px; margin-top:16px;'
             + 'margin-left:10px; background:none; color:black;'
             + 'font-family: Trebuchet MS, Arial, Helvetica; font-size: 28px;';
        var div_style = 'border:0; display:block; float:left; margin:0;';
        var results_panel_style = div_style +
              'clear:both; text-align: left; padding-top:2px; font-size: 19px; '
            + 'font-weight: normal; color:white; height: 502px;';

        var html =
              '<div id="ubiq-input-panel" style="' + div_style + ';width:99%;height:55px">'
            + '<form id="ubiq1" onsubmit="return false">'
            + '<input autocomplete="off" id="ubiq_input" style="' + input_style +'" type="text" size="60" maxlength="500">'
            + '</form>'
            + '</div>'
            + '<br/>'
            + '<div id="ubiq-results-panel" style="width:100%;' + results_panel_style + '">'
            + ubiq_help()
            + '</div>'
            + '<div id="ubiq-command-tip" style="position:absolute;left:310px;top:65px;display:block;border:0;color:#ddd;font-family:Helvetica,Arial;font-style:italic;font-size:11pt"></div>'
            + '<div id="ubiq-command-preview" style="position:absolute;left:310px;top:85px;display:block;overflow:auto;border:0;color:#ddd;"></div>'
            ;
        return html;
    }

    function ubiq_show_preview (cmd) {
        var el = document.getElementById('ubiq-command-preview');
        if (! el) return;
        if (! cmd) {
            el.innerHTML = '';
            return;
        }
        preview_func = CmdUtils.CommandList[cmd]['preview'];
        if (typeof preview_func == 'string') {
            el.innerHTML = preview_func;
        } 
        else {
            var directObj = {
                text: ubiq_command(),
            };
            preview_func(el, directObj);
        }
        return;
    }

    //  ubiq_xml_http(url, function(ajax){
    //      if (! ajax) return;
    //      var text=ajax.responseText;
    //      if (! text) return;
    //      var preview_block=document.getElementById('ubiq-command-preview');
    //      if (! preview_block) return;
    //      preview_block.innerHTML=text;
    //  });

    function ubiq_show_tip (tip) {
        var el = document.getElementById('ubiq-command-tip');
        if (! el) return;
        if (! tip) {
            el.innerHTML = '';
            return;
        }
        tip = CmdUtils.CommandList[tip]['description'];
        el.innerHTML = tip;
        return;
    }

    function ubiq_execute () {
        var cmd = ubiq_command();
        if (! cmd) return false;
        ubiq_dispatch_command(cmd);
        return false;
    }

    function ubiq_dispatch_command(line) {
        var words = line.split(' ');
        var cmd = words[0];

        var text;
        if (ubiq_selection) {
            text = ubiq_selection;
        } else {
            words.shift();
            text=words.join(' ');
        }

        // Expand match (typing 'go' will expand to 'google')
        cmd = ubiq_match_first_command(cmd);
        ubiq_replace_first_word(cmd);

        // Find command element
        var cmd_struct;
        for (var c in CmdUtils.CommandList) {
            var cmd_name = CmdUtils.CommandList[c]['name'];
            if (cmd_name == cmd) {
                cmd_struct = CmdUtils.CommandList[c];
                break;
            }
        }

        if (! cmd_struct) {
            return;
        }

        // Create a fake Ubiquity-like object, to pass to
        // command's "execute" function
        var cmd_func = cmd_struct['execute'];
        var direct_obj = { "text": text };

        // Run command's "execute" function
        cmd_func(direct_obj);

        return;
    }

    function ubiq_display_results (text) {
        var div=document.getElementById('ubiq-results-panel');
        if (! div) alert('no div!');
        div.innerHTML = text;
        div.style.visibility='show';
    }

    function ubiq_help () {
        var style = 'font-size:17px; padding:8px; font-weight:normal';
        var html = '<p style="' + style + '">Type the name of a command and press enter to execute it, or <b>help</b> for assistance.</p>';
        return html;
    }

    function ubiq_get_selection () {
        var str = '';
        if (document.getSelection) {
            str = document.getSelection();
        } else if (document.selection && document.selection.createRange) {
            var range = document.selection.createRange();
            str = range.text;
        }
        return (ubiq_selection = str);
    }

    function ubiq_toggle_window (w) {
        if (!w) return;
        var vis = w.style.visibility;
        if (vis=='hidden') vis='visible' else vis='hidden';
        w.style.visibility=vis;
        return;
    }

    function ubiq_focus (w) {
        var line=document.getElementById('ubiq_input');
        // Pre-select the input content if there's any
        if (line.value != '') line.createTextRange().select();
        line.focus();
    }

    function ubiq_enabled () {
        var wnd = ubiq_window;
        if (! wnd) return;
        var vis = wnd.style.visibility;
        if (vis=='hidden') return false;
        return true;
    }

    function ubiq_command () {
        var cmd = document.getElementById('ubiq_input');
        if (! cmd) {
            ubiq_selected_command = -1;
            return '';
        }
        return cmd.value;
    }

    // Gets current selection element
    function ubiq_get_current_element () {
        var el;
        if (document.selection && document.selection.createRange) {
            var range = document.selection.createRange();
            el = range.parentElement();
        }
        return (ubiq_element = el);
    }

    function ubiq_match_first_command(text) {
        if (! text) text = ubiq_command();
        var first_match = '';

        // Command selected through cursor UP/DOWN
        if (ubiq_first_match) {
            return ubiq_first_match;
        }

        if (text.length > 0) {
            for (var c in CmdUtils.CommandList) {
                c = CmdUtils.CommandList[c]['name'];
                if (c.match('^' + text)) {
                    first_match = c;
                    break;
                }
            }
        }
        return first_match;
    }

    function ubiq_command_icon(c) {
        var icon = CmdUtils.CommandList[c]['icon'];
        if (!icon) {
            icon = 'http://people.opera.com/cosimo/ubiquity/spacer.png';
        }
        icon = '<img src="' + icon + '" width="16" height="16" border="0" alt="" align="absmiddle"> ';
        return icon;
    }

    function ubiq_command_name(c) {
        return CmdUtils.CommandList[c]['name'];
    }

    function ubiq_replace_first_word(w) {
        if (!w) return;
        var text = ubiq_command();
        var words = text.split(' ');
        words[0] = w;
        var cmd_line = document.getElementById('ubiq_input');
        if (! cmd_line) return;
        cmd_line.value = words.join(' ');
        return;
    }

    function ubiq_show_matching_commands (text) {
        if (! text) text = ubiq_command();

        // Always consider 1st word only
        text = text.split(' ')[0];

        ubiq_first_match = null;

        var show_all = text == '*all';
        var matches = new Array();
        var substr_matches = new Array();
        if (text.length > 0) {
            for (var c in CmdUtils.CommandList) {
                var cmd = CmdUtils.CommandList[c]['name'];
                // Starting match only /^command/
                if (show_all || cmd.match('^' + text)) {
                    matches.push(c);
                }
                // Substring matching as well, in a separate list
                else if (cmd.match(text)) {
                    substr_matches.push(c);
                }
            }
        }

        // Some substring matches found, append to list of matches
        if (substr_matches.length > 0) {
            var full_matches = matches.length;
            for (m in substr_matches) {
                matches.push(substr_matches[m]);
                // Too long lists overflow from the layer
                if ((parseInt(m) + full_matches) > 11) {
                    matches.push('...');
                    break;
                }
            }
        }

        // Where to show the results
        var results_panel = document.getElementById('ubiq-results-panel');

        // Don't navigate outside boundaries of the list of matches
        if (ubiq_selected_command >= matches.length) {
            ubiq_selected_command = matches.length - 1;
        }
        else if (ubiq_selected_command == -1) {
            ubiq_selected_command = 0;
        }

        // We have matches, show a list
        if (matches.length > 0) {

            var suggestions_div = document.createElement('div');
            var suggestions_list = document.createElement('ul');
            suggestions_list.style = 'padding:0; margin:0';

            ubiq_show_tip(matches[ubiq_selected_command]);
            //ubiq_show_preview(matches[ubiq_selected_command]);

            for (var c in matches) {
                var is_selected = (c == ubiq_selected_command);
                var li=document.createElement('li');
                var li_bg=ubiq_url_for(is_selected ? 'selected_background.png' : 'command_background.png');
                c = matches[c];
                if (c == '...') {
                    li.innerHTML = c;
                }
                else {
                    var icon = ubiq_command_icon(c);
                    var cmd  = ubiq_command_name(c);
                    if (is_selected) ubiq_first_match = cmd;
                    li.innerHTML=icon + cmd;
                }
                li.style = 'color: black; list-style: none; margin:0; padding-top:8px; padding-left:12px;'
                    + 'font-family: Helvetica,Arial; font-size: 14px; height:26px;'
                    + 'background-image:'+li_bg+'; background-repeat: no-repeat;';
                suggestions_list.appendChild(li);
            }

            suggestions_div.appendChild(suggestions_list);
            results_panel.innerHTML = suggestions_div.innerHTML;

        }
        else {
            ubiq_selected_command = -1;
            ubiq_show_tip(null);
            results_panel.innerHTML = ubiq_help();
        }

        return;
    }

    function ubiq_key_handler (userjs_event) {
        if (!userjs_event) return;
        var ev = userjs_event.event;
        var kc = ev.keyCode;

        // afterEvent.keyUp ctrlKey is always false on Opera 9.63 on Linux (?)
        var ctrl_space_pressed = (kc==32) && (ev.ctrlKey || ev.metaKey);

        // If we're in the background (or not created), return immediately
        // Otherwise, activate only on CTRL + Space
        if (! ubiq_enabled()) {

            // Create our window if not already done 
            if (! ubiq_window) {
                ubiq_window = ubiq_create_window();
            }

            if (ctrl_space_pressed) {
                // Get text selection before switching window focus
                ubiq_get_selection();
                ubiq_get_current_element();
                ubiq_toggle_window(ubiq_window);
                ubiq_focus(ubiq_window);
            }
        }

        else {

            if (ctrl_space_pressed) {
                ubiq_toggle_window(ubiq_window);
                return;
            }

            // On ENTER, execute the given command
            if (kc==13) {
                ubiq_execute();
                return;
            }

            // Cursor up
            if (kc==38) {
                ubiq_select_prev_command();
            }
            // Cursor Down
            else if (kc==40) {
                ubiq_select_next_command();
            }

            ubiq_show_matching_commands();
        }

    }

    function ubiq_select_prev_command () {
        if (ubiq_selected_command > 0) {
            ubiq_selected_command--;
        }
    }

    function ubiq_select_next_command () {
        ubiq_selected_command++;
    }

    function ubiq_xml(node){
        return (node && node.nodeType) ? new XMLSerializer().serializeToString(node):'('+node+')';
    }

    function ubiq_xml_http (url,callback) {
      var xmlhttp = new opera.XMLHttpRequest();
      xmlhttp.onreadystatechange = function(){
        var s = ''+this+'\n';
        s += 'status: '+this.status+'\n';
        s += 'statusText: '+this.statusText+'\n\n';
        s += 'allheaders: '+this.getAllResponseHeaders()+'\n\n';
        s += 'responseText: '+this.responseText+'\n\n';
        s += 'responseXML: '+(ubiq_xml(this.responseXML))+'\n\n';
        var obj = {
            status: this.status,
            statusText: this.statusText,
            allheaders: this.getAllResponseHeaders(),
            responseText: this.responseText,
            responseXML: ubiq_xml(this.responseXML),
        };
        callback(obj);
      }
      xmlhttp.onload = function(){};
      //
      //  var obj = document.getElementById(elem);
      //  if (! obj) return;
      //  obj.innerHTML='';
      //  obj.style.display='';
      //}
      xmlhttp.open('GET', url, true);
      xmlhttp.send('a=b&c=d');
    }

    //--------------------------------------------------------
    //
    //               Command definitions
    //
    //--------------------------------------------------------

    CmdUtils.CreateCommand({
        name: "amazon-search",
        takes: {"search_string": noun_arb_text},
        description: "Search Amazon for books matching:",
        author: {},
        icon: "http://www.amazon.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Amazon for books matching:",
        execute: CmdUtils.SimpleUrlBasedCommand(
            'http://www.amazon.com/s/ref=nb_ss_gw?url=search-alias%3Dstripbooks&field-keywords={text}'
        )
    });

    CmdUtils.CreateCommand({
        name: "answers-search",
        takes: {"search_string": noun_arb_text},
        description: "Search Answers.com for:",
        author: {},
        icon: "http://www.answers.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Answers.com for:",
        execute: CmdUtils.SimpleUrlBasedCommand('http://www.answers.com/{text}')
    });

    CmdUtils.CreateCommand({
        name: "ask-search",
        takes: {"search_string": noun_arb_text},
        description: "Search Ask.com for the given words",
        author: {},
        icon: "http://www.ask.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Ask.com for the given words:",
        execute: CmdUtils.SimpleUrlBasedCommand('http://www.ask.com/web?q={text}')
    });

    CmdUtils.CreateCommand({
        name: "back",
        takes: {"pages": noun_arb_text}, // FIXME SHOULD BE INTEGER SOMETHING
        description: "Go back in browser history",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Go back {text} steps in history",
        execute: function (directObj) {
            var steps = parseInt (directObj.text);
            steps = - steps - 1;
            history.go(steps);
            CmdUtils.toggleUbiquityWindow();
        }
    });

    CmdUtils.CreateCommand({
        name: "bugzilla",
        takes: {"search_string": noun_arb_text},
        description: "Perform a bugzilla search for",
        author: {},
        icon: "http://www.mozilla.org/favicon.ico",
        homepage: "",
        license: "",
        preview: "Perform a bugzilla search for",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "https://bugzilla.mozilla.org/buglist.cgi?query_format=specific&order=relevance+desc&bug_status=__open__&content={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "close",
        takes: {},
        description: "Close the current window",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Close the current window",
        execute: function (directObj) {
            CmdUtils.toggleUbiquityWindow();
            CmdUtils.closeWindow();
        }
    });

    CmdUtils.CreateCommand({
        name: "clusty",
        takes: {"search_string": noun_arb_text},
        description: "Perform a clustered search through clusty.com",
        author: {},
        icon: "http://clusty.com/images/clusty-favicon.ico",
        homepage: "",
        license: "",
        preview: "Perform a clustered search through clusty.com",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://clusty.com/search?query={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "code-search",
        takes: {"search_string": noun_arb_text},
        description: "Search any source code for the given string",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://www.google.com/favicon.ico",
        homepage: "http://codesearch.google.com",
        license: "",
        preview: "Search any source code for the given string",
        execute: CmdUtils.SimpleUrlBasedCommand(
            'http://www.google.com/codesearch?client=opera&sourceid=opera&q={text}'
        )
    });

    CmdUtils.CreateCommand({
        name: "command-list",
        takes: {},
        description: "Shows the list of Ubiquity commands and what they do",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Shows the list of Ubiquity commands and what they do",
        execute: function (directObj) {
            ubiq_show_matching_commands('*all');
        }
    });

    CmdUtils.CreateCommand({
      name: "cpan",
      icon: "http://search.cpan.org/favicon.ico",
      description: "Search for a CPAN package information",
      homepage: "",
      author: { name: "Cosimo Streppone", email: "cosimo@cpan.org"},
      license: "",
      takes: {"package_name": noun_arb_text},
      preview: "Search for a CPAN package information",
      execute: CmdUtils.SimpleUrlBasedCommand(
        "http://search.cpan.org/dist/{text}"
      )
    });

    CmdUtils.CreateCommand({
        name: "currency-converter",
        takes: {"currency_spec": noun_arb_text},
        description: "Convert currency using xe.com converter service.<br/><i>Ex.: 5000 NOK to EUR</i>",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://www.xe.com/favicon.ico",
        homepage: "http://xe.com/ucc/",
        license: "",
        preview: "Convert currency values using xe.com converter service.",
        execute: function( directObj ) {
            var currency_spec = directObj.text;
            var matches = currency_spec.match(/^([\d\.]+)\s+(\w+)\s+to\s+(\w+)$/);
            var amount = matches[1];
            var curr_from = matches[2].toUpperCase();
            var curr_to = matches[3].toUpperCase();
            var xe_url = "http://www.xe.com/ucc/convert.cgi?Amount=" + escape(amount)
                + "&From=" + escape(curr_from) + "&To=" + escape(curr_to);
            Utils.openUrlInBrowser(xe_url);
        }
    });

    CmdUtils.CreateCommand({
      name: "dictionary",
      description: "Gives the meaning of a word.",
      author: { name: "Isidoros Passadis", email: "isidoros.passadis@gmail.com"},
      help: "Try issuing &quot;dictionary ubiquity&quot;",
      license: "MPL",
      icon: "http://dictionary.reference.com/favicon.ico",
      takes: {"word": noun_arb_text},
      execute: function( directObj ) {
        var word = directObj.text;
        Utils.openUrlInBrowser( "http://dictionary.reference.com/search?q=" + escape(word) );
      },
      preview: "Gives the meaning of a word.",
    });

    CmdUtils.CreateCommand({
        name: "dramatic-chipmunk",
        takes: {},
        description: "Prepare for a dramatic moment of your life",
        author: {},
        icon: "http://www.youtube.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Prepare for a dramatic moment of your life",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.youtube.com/watch?v=a1Y73sPHKxw"
        )
    });
            
    CmdUtils.CreateCommand({
        name: "ebay-search",
        takes: {"search_string": noun_arb_text},
        description: "Search ebay for the given words",
        author: {},
        icon: "http://ebay.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search ebay for the given words",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://search.ebay.com/search/search.dll?satitle={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "flickr",
        takes: {"search_string": noun_arb_text},
        description: "Search photos on Flickr",
        author: {},
        icon: "http://flickr.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search photos on Flickr",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.flickr.com/search/?q={text}&w=all"
        )
    });
            
    CmdUtils.CreateCommand({
        name: "gcalculate",
        takes: {"expression": noun_arb_text},   // FIXME a different type?
        description: "Examples: 3^4/sqrt(2)-pi,  3 inch in cm,  speed of light,  0xAF in decimal (<a href=\"http://www.googleguide.com/calculator.html\">Command list</a>)",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Examples: 3^4/sqrt(2)-pi,  3 inch in cm,  speed of light,  0xAF in decimal (<a href=\"http://www.googleguide.com/calculator.html\">Command list</a>)",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.google.com/search?client=opera&num=1&q={text}&sourceid=opera&ie=utf-8&oe=utf-8"
        )
    });
            
    CmdUtils.CreateCommand({
        name: "google-search",
        takes: {"search_string": noun_arb_text},
        description: "Search on Google for the given words",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search on Google for the given words",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.google.com/search?client=opera&num=1&q={text}&sourceid=opera&ie=utf-8&oe=utf-8"
        )
    });

    CmdUtils.CreateCommand({
        name: "help",
        takes: {},
        description: "Provides basic help on using Ubiquity for Opera",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Provides basic help on using Ubiquity for Opera",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://people.opera.com/cosimo/ubiquity/help.html"
        )
    });

    CmdUtils.CreateCommand({
        name: "image-search",
        takes: {"search_string": noun_arb_text},
        description: "Search on Google for images",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search on Google for images",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://images.google.com/images?hl=en&q={text}&client=opera&sourceid=opera"
        )
    });

    CmdUtils.CreateCommand({
        name: "imdb",
        takes: {"search_string": noun_arb_text},
        description: "Searches for movies on IMDb",
        author: {},
        icon: "http://www.imdb.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Searches for movies on IMDb",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.imdb.com/find?s=all&q={text}&x=0&y=0"
        )
    });

    CmdUtils.CreateCommand({
        name: "instant-rimshot",
        takes: {},
        description: "Instant Rimshot at your fingertips!",
        author: {},
        icon: "",
        homepage: "http://instantrimshot.com",
        license: "",
        preview: "Instant Rimshot at your fingertips!",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://instantrimshot.com/rimshot.swf"
        )
    });

    //
    // From Ubiquity feed:
    // https://ubiquity.mozilla.com/herd/all-feeds/9b0b1de981e80b6fcfee0659ffdbb478d9abc317-4742/
    //
    // Modified to get the current window domain
    //
    CmdUtils.CreateCommand({
        name: "isdown",
        icon: "http://downforeveryoneorjustme.com/favicon.ico",
        description: "Check if selected/typed URL is down",
        homepage: "http://www.andyfilms.net",
        author: { name: "Andy Jarosz", email: "andyfilms1@yahoo.com"},
        license: "GPL",
        takes: {URL: noun_arb_text},
        preview: function(pblock, directObject) {
            //ubiq_show_preview(urlString);
            //searchText = jQuery.trim(directObject.text);
            searchText = directObject.text;
            var words = searchText.split(' ');
            var host = words[1];
            if(searchText.length < 1) {
                pblock.innerHTML = "Checks if URL is down";
                return;
            }
            var previewTemplate = "Checks if <b>" + host + "</b> is down";
            pblock.innerHTML = previewTemplate;
        },
        execute: function(directObject) {
            var url = "http://downforeveryoneorjustme.com/{QUERY}"
            var query = directObject.text;
            // Get the hostname from url
            if (! query) {
                var host = window.location.href;
                var url_comp = host.split('/');
                query = url_comp[2];
            }
            var urlString = url.replace("{QUERY}", query);
            //Utils.openUrlInBrowser(urlString);
            ubiq_xml_http(urlString, function (ajax) {
                if (! ajax) return;
                var text = ajax.responseText;
                if (! text) return;
                var pblock = document.getElementById('ubiq-command-preview');
                if (text.match('is up.')) {
                    pblock.innerHTML = '<br/><p style="font-size: 18px;">It\'s just you. The site is <b>up!</b></p>';
                } else {
                    pblock.innerHTML = '<br/><p style="font-size: 18px;">It\'s <b>not</b> just you. The site is <b>down!</b></p>';
                }
            });
        }
    });

    CmdUtils.CreateCommand({
        name: "lastfm",
        takes: {"search_string": noun_arb_text},
        description: "Listen to some artist radio on Last.fm",
        author: {},
        icon: "http://last.fm/favicon.ico",
        homepage: "",
        license: "",
        preview: "Listen to some artist radio on Last.fm",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.lastfm.com/listen/artist/{text}/similarartists"
        )
    });

    CmdUtils.CreateCommand({
        name: "maps",
        takes: {"address": noun_arb_text},
        description: "Shows a location on the map",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Shows a location on the map",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://maps.google.com/maps?q={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "msn-search",
        takes: {"search_string": noun_arb_text},
        description: "Search MSN for the given words",
        author: {},
        icon: "http://www.msn.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Searches MSN for the given words",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://search.msn.com/results.aspx?q={text}"
        )
    });
            
    CmdUtils.CreateCommand({
        name: "myopera-blog-search",
        takes: {"search_string": noun_arb_text},
        description: "Search for blogs on the My Opera Community",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://static.myopera.com/community/favicon.ico",
        homepage: "http://my.opera.com",
        license: "",
        preview: "Search for blogs on the My Opera Community",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://my.opera.com/community/blogs/?search={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "myopera-photo-search",
        takes: {"search_string": noun_arb_text},
        description: "Search for photos on the My Opera Community",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://static.myopera.com/community/favicon.ico",
        homepage: "http://my.opera.com",
        license: "",
        preview: "Search for photos on the My Opera Community",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://my.opera.com/community/photos/?search={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "new-tab",
        takes: {"URL": noun_arb_text},  // FIXME URL type??
        description: "Open a new tab (or window) with the specified URL",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Open a new tab (or window) with the specified URL",
        execute: function (directObj) {
            var url = 'about:';
            if (directObj) {
                url = directObj.text;
            }    
            CmdUtils.toggleUbiquityWindow();
            window.open(url);
        }
    });

    CmdUtils.CreateCommand({
        name: "opera-cache",
        takes: {},
        description: "Show Opera browser cache contents",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://www.opera.com/favicon.ico",
        homepage: "http://www.opera.com",
        license: "",
        preview: "Show Opera browser cache contents",
        execute: CmdUtils.SimpleUrlBasedCommand("opera:cache")
    });

    CmdUtils.CreateCommand({
        name: "opera-config",
        takes: { "config_option": noun_arb_text },
        description: "Show Opera browser preferences (filtered by given words)",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://www.opera.com/favicon.ico",
        homepage: "http://www.opera.com",
        license: "",
        preview: "Show Opera browser preferences (filtered by given words)",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "opera:config#{text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "opera-skins",
        takes: {"search_string": noun_arb_text},
        description: "Search for Opera browser skins on the My Opera Community",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://static.myopera.com/community/favicon.ico",
        homepage: "http://my.opera.com/community/customize/skins/",
        license: "",
        preview: "Search for Opera browser skins on the My Opera Community",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://my.opera.com/community/customize/skins/?search={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "print",
        takes: {},
        description: "Print the current page",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Print the current page",
        execute: function (directObj) {
            CmdUtils.toggleUbiquityWindow();
            window.print();
        }
    });

    CmdUtils.CreateCommand({
        name: "refresh",
        takes: {},
        description: "Reloads the current document",
        author: {},
        icon: "",
        homepage: "",
        license: "",
        preview: "Reloads the current document",
        execute: function (directObj) {
            CmdUtils.toggleUbiquityWindow();
            CmdUtils.getLocation().reload();
        }
    });

    CmdUtils.CreateCommand({
        name: "search",
        takes: {"search_string": noun_arb_text},
        description: "Search on Google for the given words",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search on Google for the given words",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.google.com/search?client=opera&num=1&q={text}&sourceid=opera&ie=utf-8&oe=utf-8"
        )
    });

    CmdUtils.CreateCommand({
      name: "slideshare",
      icon: "http://www.slideshare.com/favicon.ico",
      description: "Search for online presentations on SlideShare",
      homepage: "",
      author: { name: "Cosimo Streppone", email: "cosimo@cpan.org"},
      license: "",
      takes: {"search_term": noun_arb_text},
      preview: "Search for online presentations on SlideShare",
      execute: CmdUtils.SimpleUrlBasedCommand(
        "http://www.slideshare.net/search/slideshow?q={text}&submit=post&searchfrom=header&x=0&y=0"
      )
    });

    CmdUtils.CreateCommand({
        name: "stackoverflow-search",
        takes: {"search_string": noun_arb_text},
        description: "Searches questions and answers on stackoverflow.com",
        author: { name: "Cosimo Streppone", email: "cosimo@cpan.org" },
        icon: "http://stackoverflow.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Searches questions and answers on stackoverflow.com",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://stackoverflow.com/search?q={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "torrent-search",
        takes: { "search_string": noun_arb_text },
        description: "Search PirateBay, Isohunt, and Torrentz in new tabs.",
        author: { name: "Axel Boldt", email: "axelboldt@yahoo.com"},
        homepage: "http://math-www.uni-paderborn.de/~axel/",
        license: "Public domain",
        preview: "Search for torrent on PirateBay, Isohunt and Torrentz.",
        execute: function( directObj ) {
            var search_string = encodeURIComponent(directObj.text);
            Utils.openUrlInBrowser( "http://thepiratebay.org/search.php?q=" + search_string);
            Utils.openUrlInBrowser( "http://isohunt.com/torrents/?ihq=" + search_string);
            Utils.openUrlInBrowser( "http://www.torrentz.com/search?q=" + search_string);
        }
    });

    CmdUtils.CreateCommand({
        name: "translate",
        takes: { "words": noun_arb_text },
        description: "Translates the given words (or text selection, or the current window) to English",
        author: {},
        icon: "http://www.google.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Translates the given words (or text selection, or the current window) to English",
        execute: function (directObj) {
            CmdUtils.toggleUbiquityWindow();
            var text = directObj.text;
            // HARD !!!
            //alert(ubiq_element.innerHTML);
            //var html = ubiq_element.innerHTML.replace(text, 'blah blah blah');
            //ubiq_element.innerHTML = html;
            var words = text.split(/\s+/);
            var dest = 'auto';

            // Detect the destination language ("translate ... to it")
            if (words.length >= 3 && words[words.length - 2].toLowerCase()=='to') {
                // Get destination language
                dest = words.pop();
                // Remove the 'to'
                words.pop();
                // Update the text to be translated
                text = words.join('');
            }

            // Translate text or current URL
            var url = 'http://translate.google.com/translate_t?#auto|'+dest+'|';
            if (! text || text.length == 0 || text.match('^https?://')) {
                if (! text) text = CmdUtils.getLocation();
                url = 'http://translate.google.com/translate?prev=_t&ie=UTF-8&sl=auto&tl='+dest+'&history_state0=&u=';
            }
            CmdUtils.openWindow(url+text);
        }
    });

    CmdUtils.CreateCommand({
        name: "validate",
        icon: "http://www.imageboo.com/files/uhee2ii315oxd8akq0nm.ico",
        description: "Checks the markup validity of the current Web document",
        preview: "Sends this page to the W3C validator",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://validator.w3.org/check?uri={location}"
        )
    });

    CmdUtils.CreateCommand({  
          name: "wayback",  
          homepage: "http://www.pendor.com.ar/ubiquity",  
          author: { name: "Juan Pablo Zapata", email: "admin@pendor.com.ar" },  
          description: "Search old versions of a site using the Wayback Machine (archive.org)",
          help: "wayback <i>sitio a buscar</i>", 
          icon: "http://web.archive.org/favicon.ico", 
          takes: {"Site to search": noun_arb_text},  
          preview: function(pblock, theShout) {  
              pblock.innerHTML = "Buscar versiones antiguas del sitio <b>" +  theShout.text + "</b>"          
          },
          execute: function (directObj) {
              CmdUtils.toggleUbiquityWindow();
              var url = directObj.text;
              if (! url) url = CmdUtils.getLocation();
              var wayback_machine = "http://web.archive.org/web/*/" + url;
              // Take me back!
              CmdUtils.openWindow(wayback_machine);
          }
    });

    CmdUtils.CreateCommand({
        name: "weather",
        takes: {"location": noun_arb_text},
        description: "Show the weather forecast for",
        author: {},
        icon: "http://www.accuweather.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Show the weather forecast for",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.wunderground.com/cgi-bin/findweather/getForecast?query={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "wikipedia",
        takes: {"search_string": noun_arb_text},
        description: "Search Wikipedia for the given words",
        author: {},
        icon: "http://en.wikipedia.org/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Wikipedia for the given words",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://en.wikipedia.org/wiki/Special:Search?search={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "yahoo-answers",
        takes: {"question": noun_arb_text},
        description: "Search Yahoo! Answers for",
        author: {},
        icon: "http://l.yimg.com/a/i/us/sch/gr/answers_favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Yahoo! Answers for",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://answers.yahoo.com/search/search_result;_ylv=3?p={text}"
        )
    });

    CmdUtils.CreateCommand({
        name: "yahoo-search",
        takes: {"search_string": noun_arb_text},
        description: "Search Yahoo! for",
        author: {},
        icon: "http://www.yahoo.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search Yahoo! for",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://search.yahoo.com/search?p={text}&ei=UTF-8"
        )
    });

    CmdUtils.CreateCommand({
        name: "youtube",
        takes: {"videos": noun_arb_text},
        description: "Search for videos on YouTube",
        author: {},
        icon: "http://www.youtube.com/favicon.ico",
        homepage: "",
        license: "",
        preview: "Search for videos on YouTube",
        execute: CmdUtils.SimpleUrlBasedCommand(
            "http://www.youtube.com/results?search_type=search_videos&search_sort=relevance&search_query={text}&search=Search"
        )
    });

    // Add event handler to window 
    opera.addEventListener('afterEvent.keyup', ubiq_key_handler, false);

}) (opera);

// vim: ts=4 sw=4 tw=0 et

