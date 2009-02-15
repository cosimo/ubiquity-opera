/*
	Ubiquity for Opera? A nightly experiment...
	First version: Cosimo 17/01/2009

	$Id$
*/

var ubiq_window;
var ubiq_selection;
var ubiq_element;

function ubiq_create_window () {
    var doc = window.document;
    var wnd = document.createElement('div');
    var stl = wnd.style;
    wnd.setAttribute('id', 'ubiq_window');
    stl.position='absolute';
    stl.left=1;
    stl.top=1;
    stl.visibility='hidden';
    stl.width='810px';
    stl.height='561px';
    stl.border='0';
    stl.padding='0';
    /* Our window should appear on top of everything */
    stl.zIndex='99999';
    stl.background='url(http://www.streppone.it/ubiq/ubiq_background.png)';
    wnd.innerHTML = ubiq_start_mode();
    doc.body.appendChild(wnd);
    return wnd;
}

function ubiq_start_mode () {
    var input_style =
           'border:0; padding:0; height:32px; margin-top:16px;'
         + 'margin-left:10px; background:none; color:black;'
         + 'font-family: Trebuchet MS, Arial, Helvetica; font-size: 28px;';
    var div_style = 'width:100%; border:0; display:block; float:left; margin: 0px 5px 0px 5px;';
	var results_panel_style = div_style + 'clear:both; text-align: left; padding-top: 8px; font-size: 1.4em; color:white; height: 502px;';
    var html =
          '<div id="ubiq-input-panel" style="' + div_style + 'height:55px">'
        + '<form id="ubiq1" onsubmit="return false">'
        + '<input id="ubiq_input" style="' + input_style +'" type="text" size="60" maxlength="500">'
        + '</form>'
        + '</div>'
        + '<br/>'
        + '<div id="ubiq-results-panel" style="' + results_panel_style + '">'
		+ ubiq_help()
        + '</div>';
    //html += '<' + 'script language="javascript">document.addEventListener("keydown",ubiq_active_key_handler,false);</script>';
    return html;
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
		words[0] = '';
		text= words.join(' ');
	}

	if (cmd=='tran-no') {
		ubiq_cmd_translate_no(text);
	}
	else if (cmd=='map') {
		ubiq_cmd_map(text);
	}
	else if (cmd=='refresh') {
		ubiq_cmd_refresh();
	}
	else if (cmd=='weather') {
		ubiq_cmd_weather(text);
	}
	else if (cmd=='h' || cmd=='help') {
		ubiq_display_results(ubiq_help());
	}

	return;
}

function ubiq_display_results (text) {
	//var wnd=ubiq_window;
	var div=document.getElementById('ubiq-results-panel');
	if (! div) alert('no div!');
	opera.postError('help text='+text);
	div.innerHTML = text;
	div.style.visibility='show';
}

function ubiq_help () {
    var html = 'Type the name of a command and press enter to execute it, or <b>help</b> for assistance.';
	return html;
}

function ubiq_cmd_translate_no(text) {
	ubiq_toggle_window(ubiq_window);
	// HARD !!!
	//alert(ubiq_element.innerHTML);
	//var html = ubiq_element.innerHTML.replace(text, 'blah blah blah');
	//ubiq_element.innerHTML = html;
	ubiq_new_window('http://translate.google.com/translate_t?#no|en|'+text);
}

function ubiq_cmd_refresh() {
	ubiq_toggle_window(ubiq_window);
	document.location.reload();
}

function ubiq_cmd_weather(text) {
	ubiq_toggle_window(ubiq_window);
	ubiq_new_window('http://www.wunderground.com/cgi-bin/findweather/getForecast?query='+escape(text));
}

function ubiq_cmd_map(address) {
	ubiq_toggle_window(ubiq_window);
	ubiq_new_window('http://maps.google.com/maps?q='+escape(address));
}

function ubiq_new_window(url) {
	window.open(url, 'ubiq_tab');
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
    if (! cmd) return;
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

function ubiq_key_handler (userjs_event) {
    if (!userjs_event) return;
    var ev = userjs_event.event;
	var kc = ev.keyCode;
	var ctrl_space_pressed = ev.ctrlKey && kc==32;

    // If we're in the background (or not created), return immediately
    // Otherwise, activate only on CTRL + Space
	if (! ubiq_enabled()) {

		// Create our window if not already done 
		if (! ubiq_window)
			ubiq_window = ubiq_create_window();

		if (ctrl_space_pressed) {

    		// Get text selection before switching window focus
			ubiq_get_selection();

    		// Get text selection before switching window focus
			ubiq_get_current_element();

    		// Get text selection before switching window focus
			ubiq_toggle_window(ubiq_window);

    		// And focus on the input line
			ubiq_focus(ubiq_window);
		}
	}

	else {

		if (ctrl_space_pressed) {
			ubiq_toggle_window(ubiq_window);
			return;
		}

		if (kc==13) {
			ubiq_execute();
		}

	}

}

/* Add event handler to window */
window.opera.addEventListener('afterEvent.keyup', ubiq_key_handler, false);

