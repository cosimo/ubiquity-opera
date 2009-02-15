/*
	Ubiquity for Opera? A nightly experiment...
	First version: Cosimo 17/01/2009

	$Id$

*/

var ubiq_commands = new Array (
    'amazon-search',
    'answers-search',
    'ask-search',
    'back',
    'bugzilla',
    'close',
    'command-list',
    'ebay-search',
    'gcalculate',
    'google',
    'help',
    'image-search',
    'map',
    //'opera-bugs',
    'refresh',
    'search',
    'translate-no',
    'weather'
);
var ubiq_commands_tip = new Array (
    'Searches Amazon for books matching:',
    'Searches Answers.com for:',
    'Searches Ask.com for the given words',
    'Go back 1 step in history',
    'Perform a bugzilla search for',
    'Close the current window',
    'Shows the list of Ubiquity commands and what they do',
    'Searches EBay for the given words',
    'Examples: 3^4/sqrt(2)-pi,  3 inch in cm,  speed of light,  0xAF in decimal (<a href="http://www.googleguide.com/calculator.html">Command list</a>)',
    'Searches Google for your words',
    'Provides basic help on using Ubiquity for Opera',
    'Search on Google Images',
    'Shows a location on the map',
    //'Search in the Opera bug tracking database for',
    'Refreshes current document',
    'Search using Google for:',
    'Translates the given words from Norwegian to English',
    'Shows the weather forecast for:'
);
var ubiq_window;
var ubiq_selection;
var ubiq_element;
var ubiq_remote_server = 'http://people.opera.com/cosimo/ubiquity';

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
    var div_style = 'width:100%; border:0; display:block; float:left; margin: 0px 5px 0px 5px;';
	var results_panel_style = div_style + 'clear:both; text-align: left; padding-top: 8px; font-size: 19px; font-weight: normal; color:white; height: 502px;';
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

    if (cmd=='translate-no') { // TODO change this to generalize
        ubiq_cmd_translate_no(text);
    }
    else if (cmd=='amazon-search') {
        ubiq_cmd_url_based('http://www.amazon.com/s/ref=nb_ss_gw?url=search-alias%3Dstripbooks&field-keywords=' + escape(text));
    }
    else if (cmd=='answers-search') {
        ubiq_cmd_url_based('http://www.answers.com/' + escape(text));
    }
    else if (cmd=='ask-search') {
        ubiq_cmd_url_based('http://www.ask.com/web?q=' + escape(text));
    }
    else if (cmd=='back') {
        history.go(-2);
        ubiq_toggle_window(ubiq_window);
    }
    else if (cmd=='bugzilla') {
        ubiq_cmd_url_based('https://bugzilla.mozilla.org/buglist.cgi?query_format=specific&order=relevance+desc&bug_status=__open__&content='+escape(text));
    }
    else if (cmd=='close') {
        ubiq_toggle_window(ubiq_window);
        window.close();
    }
    else if (cmd=='command-list') {
        ubiq_show_matching_commands('*all');
    }
    else if (cmd=='ebay-search') {
        ubiq_cmd_url_based('http://search.ebay.com/search/search.dll?satitle=' + escape(text));
    }
    else if (cmd=='image-search') {
        ubiq_cmd_url_based('http://images.google.com/images?hl=en&q='+escape(text)+'&client=opera&sourceid=opera');
    }
    else if (cmd=='gcalculate') {
        ubiq_cmd_url_based('http://www.google.com/search?client=opera&num=1&q='+escape(text)+'&sourceid=opera&ie=utf-8&oe=utf-8');
    }
    else if (cmd=='google' || cmd=='search') {
        ubiq_cmd_url_based('http://www.google.com/search?client=opera&q='+escape(text)+'&sourceid=opera&ie=utf-8&oe=utf-8');
    }
    else if (cmd=='map') {
        ubiq_cmd_url_based('http://maps.google.com/maps?q='+escape(text));
    }
    else if (cmd=='refresh') {
        ubiq_cmd_refresh();
    }
    else if (cmd=='weather') {
        ubiq_cmd_url_based('http://www.wunderground.com/cgi-bin/findweather/getForecast?query='+escape(text));
    }
    else if (cmd=='h' || cmd=='help') {
        ubiq_display_results(ubiq_help());
    }

    return;
}

function ubiq_cmd_url_based (url) {
    ubiq_toggle_window(ubiq_window);
    ubiq_new_window(url);
}

function ubiq_display_results (text) {
    var div=document.getElementById('ubiq-results-panel');
    if (! div) alert('no div!');
    opera.postError('help text='+text);
    div.innerHTML = text;
    div.style.visibility='show';
}

function ubiq_help () {
    var html = '<p>Type the name of a command and press enter to execute it, or <b>help</b> for assistance.</p>';
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

function ubiq_show_matching_commands (text) {
    if (! text) text = ubiq_command();
    var show_all = text == '*all';
    var matches = new Array();
    if (text.length > 0) {
        for (var c in ubiq_commands) {
            c = ubiq_commands[c] + ' <span style="font-family:Helvetica,Arial;font-style:italic;font-size:14px;">' + ubiq_commands_tip[c] + '</span>';
            if (show_all || c.match('^' + text)) {
                matches.push(c);
            }
        }
    }

    // Where to show the results
    var results_panel = document.getElementById('ubiq-results-panel');

    // We have matches, show a list
    if (matches.length > 0) {

        var suggestions_div = document.createElement('div');
        var suggestions_list = document.createElement('ul');

        for (var c in matches) {
            var li=document.createElement('li');
            li.innerHTML=matches[c];
            li.style = 'list-style: none; padding:0; margin:0; font-family: monospace; font-size: 1.0em';
            suggestions_list.appendChild(li);
        }

        suggestions_div.appendChild(suggestions_list);
        results_panel.innerHTML = suggestions_div.innerHTML;
    }
    else {
        results_panel.innerHTML = ubiq_help();
    }

    return;
}

function ubiq_key_handler (userjs_event) {
    if (!userjs_event) return;
    var ev = userjs_event.event;
	var kc = ev.keyCode;
	var ctrl_space_pressed = kc == 32 && ev.ctrlKey;

    // If we're in the background (or not created), return immediately
    // Otherwise, activate only on CTRL + Space
	if (! ubiq_enabled()) {
    	// Create our window if not already done 
		if (! ubiq_window)
			ubiq_window = ubiq_create_window();

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

        ubiq_show_matching_commands();
	}

}

/* Add event handler to window */
window.opera.addEventListener('afterEvent.keyup', ubiq_key_handler, false);

// vim: ts=4 sw=4 tw=0 et

