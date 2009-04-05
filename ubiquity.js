//
// Ubiquity for Opera? A nightly experiment...
// -------------------------------------------
//
// An attempt to rewrite Firefox's Ubiquity extension
// for Opera using UserJS.
//
// Original Ubiquity Project: http://labs.mozilla.org/ubiquity/
//
// To use this in Opera, you have to:
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
//
//
// $Id$
;

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
CmdUtils.closeWindow = function closeWindow () {
    CmdUtils.getWindow().close();
}
CmdUtils.getDocument = function getDocument () {
    return document;
}
CmdUtils.getLocation = function getLocation () {
    return CmdUtils.getDocument().location;
}
CmdUtils.getWindow = function getWindow () {
    return window;
}
CmdUtils.openWindow = function openWindow (url,name) {
    if (!name) {
        CmdUtils.getWindow().open(url);
    } else {
        CmdUtils.getWindow().open(url, name);
    }
}
// Search 2nd order function
CmdUtils.SimpleUrlBasedCommand = function SimpleUrlBasedCommand (url) {
    if (! url) return;
    var search_func = function (directObj) {
        if (! directObj) return;
        var text = directObj.text;
        text = encodeURIComponent(text);
        url = url.replace('{text}', text);
        url = url.replace('{location}', CmdUtils.getLocation());
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
    stl.position='absolute';
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
    if (icon) icon = 'src="' + icon + '" ';
    icon = '<img '+ icon + ' width="16" height="16" border="0" alt="" align="absbottom"> ';
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

// Add event handler to window 
window.opera.addEventListener('afterEvent.keyup', ubiq_key_handler, false);

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
    name: "define",
    takes: {"search_string": noun_arb_text},
    description: "Gives the definition of a word",
    author: {},
    icon: "http://www.ask.com/favicon.ico",
    homepage: "",
    license: "",
    preview: "Gives the definition of a word",
    execute: CmdUtils.SimpleUrlBasedCommand('http://www.ask.com/web?q={text}')
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
      execute: CmdUtils.SimpleUrlBasedCommand(
          "http://web.archive.org/web/*/{text}"
      )
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

// vim: ts=4 sw=4 tw=0 et
