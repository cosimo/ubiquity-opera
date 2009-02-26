/*
Ubiquity for Opera? A nightly experiment...
----------------------------------------------

An attempt to rewrite Firefox's Ubiquity extension
for Opera using UserJS.

Original Ubiquity Project: http://labs.mozilla.org/ubiquity/

To use this in Opera, you have to:

* Enable UserJS. Point your browser to opera:config#Javascript and:

  - tick "User Javascript" checkbox
  - type the folder you want to run the scripts from
    in the "User Javascript File" textfield

  If you want, you can also allow UserJS execution in
  HTTPS pages.

* Remove the default shortcut key bound to CTRL + SPACE,
  since the original Ubiquity is activated and deactivated
  with CTRL + SPACE.

Have fun!

----------------------------------------------
Cosimo Streppone, <cosimo@opera.com>
First version: 19/01/2009
*/

// $Id$

var ubiq_commands = new Array (
    'amazon-search',
    'answers-search',
    'ask-search',
    'back',
    'bugzilla',
    'close',
    'command-list',
    'define',
    'ebay-search',
    'flickr',
    'google',
    'gcalculate',
    'help',
    'image-search',
    'imdb',
    'lastfm',
    'map',
    'msn-search',
    'myopera-blogs',
    'myopera-photos',
    'new-tab',
    'opera-config',
    'opera-cache',
    //'opera-bugs',
    'print',
    'refresh',
    'search',
    'skin-list',
    'translate-no',
    //'twitter',   *** Non functional, due to security restrictions. I have an idea... 
    'weather',
    'wikipedia',
    'yahoo-answers',
    'yahoo-search',
    'youtube'
);

var ubiq_commands_tip = new Array (
    'Searches Amazon for books matching:',
    'Searches Answers.com for',
    'Searches Ask.com for the given words',
    'Go back 1 step in history',
    'Perform a bugzilla search for',
    'Close the current window',
    'Shows the list of Ubiquity commands and what they do',
    'Gives the definition of a word',
    'Searches EBay for the given words',
    'Searches for photos on Flickr',
    'Searches Google for your words',
    'Examples: 3^4/sqrt(2)-pi,  3 inch in cm,  speed of light,  0xAF in decimal (<a href="http://www.googleguide.com/calculator.html">Command list</a>)',
    'Provides basic help on using Ubiquity for Opera',
    'Search on Google Images',
    'Searches for movies on imdb',
    'Listen to some artist radio on Last.fm',
    'Shows a location on the map',
    'Searches MSN for the given words',
    'Searches for blogs on the My Opera Community',
    'Searches for photos on the My Opera Community',
    'Opens a new tab (or window) with the specified URL',
    'Shows your Opera browser preferences (filtered by given words)',
    'Shows your Opera browser cache contents',
    'Print current page',
    //'Search in the Opera bug tracking database for',
    'Refreshes current document',
    'Search using Google for',
    'Browse or search Opera skins on my.opera.com',
    'Translates the given words (or text selection, or the current window) from Norwegian to English',
    //'Update your twitter status',
    'Shows the weather forecast for',
    'Searches Wikipedia',
    'Searches Yahoo Answers for',
    'Searches Yahoo for',
    'Searches for videos on Youtube'
);

var ubiq_commands_icon = new Array (
    'http://www.amazon.com/favicon.ico',
    'http://www.answers.com/favicon.ico',
    'http://www.ask.com/favicon.ico',
    '',
    'http://www.mozilla.org/favicon.ico',
    '',
    '', // Command list?
    'http://www.answers.com/favicon.ico',
    'http://ebay.com/favicon.ico',
    'http://flickr.com/favicon.ico',
    'http://www.google.com/favicon.ico',
    '', // Calculator?
    'http://upload.wikimedia.org/wikipedia/commons/4/44/Help-browser.svg',
    'http://www.google.com/favicon.ico',
    'http://www.imdb.com/favicon.ico',
    'http://lastfm.com/favicon.ico',
    'http://www.google.com/favicon.ico', // Maps
    'http://www.live.com/favicon.ico',
    'http://my.opera.com/favicon.ico',
    'http://my.opera.com/favicon.ico',
    '',
    'http://www.opera.com/favicon.ico',
    'http://www.opera.com/favicon.ico',
    '',
    '',
    'http://www.google.com/favicon.ico',
    'http://my.opera.com/favicon.ico',
    'http://www.google.com/favicon.ico',
    //'http://www.twitter.com/favicon.ico',
    'http://www.accuweather.com/favicon.ico',
    'http://en.wikipedia.org/favicon.ico',
    'http://l.yimg.com/a/i/us/sch/gr/answers_favicon.ico',
    'http://www.yahoo.com/favicon.ico',
    'http://www.youtube.com/favicon.ico'
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
    var div_style = 'width:100%; border:0; display:block; float:left; margin:0;';
	var results_panel_style = div_style + 'clear:both; text-align: left; padding-top:2px; font-size: 19px; font-weight: normal; color:white; height: 502px;';
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
        words.shift();
        text=words.join(' ');
    }

    // Expand match (typing 'go' will expand to 'google')
    cmd = ubiq_match_first_command(cmd);

    if (cmd=='translate-no') { // TODO change this to generalize
        ubiq_cmd_translate_no(text);
    }
    else if (cmd=='amazon-search') {
        ubiq_cmd_url_based('http://www.amazon.com/s/ref=nb_ss_gw?url=search-alias%3Dstripbooks&field-keywords=' + escape(text));
    }
    else if (cmd=='answers-search') {
        ubiq_cmd_url_based('http://www.answers.com/' + escape(text));
    }
    else if (cmd=='ask-search' || cmd=='define') {
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
    else if (cmd=='flickr') {
        ubiq_cmd_url_based('http://www.flickr.com/search/?q='+escape(text)+'&w=all');
    }
    else if (cmd=='gcalculate') {
        ubiq_cmd_url_based('http://www.google.com/search?client=opera&num=1&q='+escape(text)+'&sourceid=opera&ie=utf-8&oe=utf-8');
    }
    else if (cmd=='google' || cmd=='search') {
        ubiq_cmd_url_based('http://www.google.com/search?client=opera&q='+escape(text)+'&sourceid=opera&ie=utf-8&oe=utf-8');
    }
    else if (cmd=='image-search') {
        ubiq_cmd_url_based('http://images.google.com/images?hl=en&q='+escape(text)+'&client=opera&sourceid=opera');
    }
    else if (cmd=='imdb') {
        ubiq_cmd_url_based('http://www.imdb.com/find?s=all&q='+escape(text)+'&x=0&y=0');
    }
    else if (cmd=='lastfm') {
        ubiq_cmd_url_based('http://www.lastfm.com/listen/artist/'+escape(text)+'/similarartists');
    }
    else if (cmd=='map') {
        ubiq_cmd_url_based('http://maps.google.com/maps?q='+escape(text));
    }
    else if (cmd=='msn-search') {
        ubiq_cmd_url_based('http://search.msn.com/results.aspx?q='+escape(text));
    }
    else if (cmd=='myopera-blogs') {
        ubiq_cmd_url_based('http://my.opera.com/community/blogs/?search='+escape(text));
    }
    else if (cmd=='myopera-photos') {
        ubiq_cmd_url_based('http://my.opera.com/community/photos/?search='+escape(text));
    }
    else if (cmd=='new-tab') {
        ubiq_toggle_window(ubiq_window);
        // Open a new tab with URL = text
        if (! text) text='about:';
        window.open(text);
    }
    else if (cmd=='opera-config') {
        ubiq_cmd_url_based('opera:config#' + escape(text));
    }
    else if (cmd=='opera-cache') {
        ubiq_cmd_url_based('opera:cache');
    }
    else if (cmd=='print') {
        ubiq_toggle_window(ubiq_window);
        window.print();
    }
    else if (cmd=='refresh') {
        ubiq_cmd_refresh();
    }
    else if (cmd=='skin-list') {
        ubiq_cmd_url_based('http://my.opera.com/community/customize/skins/?search=' + escape(text));
    }
    else if (cmd=='twitter') {
        ubiq_cmd_twitter_status(text);
    }
    else if (cmd=='yahoo-search') {
        ubiq_cmd_url_based('http://search.yahoo.com/search?p='+escape(text)+'&ei=UTF-8');
    }
    else if (cmd=='weather') {
        ubiq_cmd_url_based('http://www.wunderground.com/cgi-bin/findweather/getForecast?query='+escape(text));
    }
    else if (cmd=='wikipedia') {
        ubiq_cmd_url_based('http://en.wikipedia.org/wiki/Special:Search?search='+escape(text));
    }
    else if (cmd=='help' || cmd=='about') {
        ubiq_display_results(ubiq_help());
    }
    else if (cmd=='yahoo-answers') {
        ubiq_cmd_url_based('http://answers.yahoo.com/search/search_result;_ylv=3?p='+escape(text));
    }
    else if (cmd=='yahoo-search') {
        ubiq_cmd_url_based('http://search.yahoo.com/search?p='+escape(text)+'&ei=UTF-8');
    }
    else if (cmd=='youtube') {
        ubiq_cmd_url_based('http://www.youtube.com/results?search_type=search_videos&search_sort=relevance&search_query='+escape(text)+'&search=Search');
    }

    return;
}

function ubiq_cmd_twitter_status(text) {
    ubiq_toggle_window(ubiq_window);
    var endpoint = 'http://twitter.com/statuses/update.json';
    ubiq_post_request(endpoint, 'status='+escape(text)+'&app=myopera');
    return;
}

// Fire and forget POST request
// XXX This will never work, due to security restrictions, unless...
function ubiq_post_request (url, params) {
    var req=new XMLHttpRequest();
    req.open('POST',url,true);
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    req.setRequestHeader('Content-length', params.length);
    req.setRequestHeader('Connection', 'close');
    req.send(params);
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
    var style = 'font-size:17px; padding:8px; font-weight:normal';
    var html = '<p style="' + style + '">Type the name of a command and press enter to execute it, or <b>help</b> for assistance.</p>';
    return html;
}

function ubiq_cmd_translate_no(text) {
    ubiq_toggle_window(ubiq_window);
    // HARD !!!
    //alert(ubiq_element.innerHTML);
    //var html = ubiq_element.innerHTML.replace(text, 'blah blah blah');
    //ubiq_element.innerHTML = html;
    if (! text || text.length == 0 || text.match('^https?://')) {
        if (! text) text = window.location.href;
        url = 'http://translate.google.com/translate?prev=_t&ie=UTF-8&sl=no&tl=en&history_state0=&u=';
    } else {
        url = 'http://translate.google.com/translate_t?#no|en|';
    }
    ubiq_new_window(url + text);
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

function ubiq_match_first_command(text) {
    if (! text) text = ubiq_command();
    var first_match = '';
    if (text.length > 0) {
        for (var c in ubiq_commands) {
            c = ubiq_commands[c];
            if (c.match('^' + text)) {
                first_match = c;
                break;
            }
        }
    }
    return first_match;
}

function ubiq_show_matching_commands (text) {
    if (! text) text = ubiq_command();

    // Always consider 1st word only
    text = text.split(' ')[0];

    var show_all = text == '*all';
    var matches = new Array();
    var substr_matches = new Array();
    if (text.length > 0) {
        for (var c in ubiq_commands) {
            var tip = ' <span style="color: #ddd; font-family:Helvetica,Arial;font-style:italic;font-size:14px;">' + ubiq_commands_tip[c] + '</span>';
            var icon = ubiq_commands_icon[c];
            if (icon) icon = 'src="' + icon + '" ';
            icon = '<img '+ icon + ' width="16" height="16" border="0" align="absbottom"> ';
            c = ubiq_commands[c];
            // Starting match only /^command/
            if (show_all || c.match('^' + text)) {
                matches.push(icon + c + ' &rarr; ' + tip);
            }
            // Substring matching as well, in a separate list
            else if (c.match(text)) {
                substr_matches.push(icon + c + ' &rarr; ' + tip);
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

    // We have matches, show a list
    if (matches.length > 0) {

        var suggestions_div = document.createElement('div');
        var suggestions_list = document.createElement('ul');
        suggestions_list.style = 'padding:0; margin:0';

        for (var c in matches) {
            var li=document.createElement('li');
            var li_bg=ubiq_url_for(c==0 ? 'selected_background.png' : 'command_background.png');
            //var li_bg=ubiq_url_for('command_background.png');
            li.innerHTML=matches[c];
            li.style = 'color: black; list-style: none; margin:0; padding-top:8px; padding-left:12px;'
                + 'font-family: Helvetica,Arial; font-size: 14px; height:26px;'
                + 'background-image:'+li_bg+'; background-repeat: no-repeat;';
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
        ubiq_show_matching_commands();
	}
}

/* Add event handler to window */
window.opera.addEventListener('afterEvent.keyup', ubiq_key_handler, false);

// vim: ts=4 sw=4 tw=0 et
