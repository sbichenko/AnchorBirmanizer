/**
 * @author Stanislav Bichenko (s.bichenko@gmail.com)
 * @link https://github.com/sbichenko/AnchorBirmanizer
 * @requires jQuery
 *
 * DESCRIPTION:
 * http://ilyabirman.ru/meanwhile/2008/12/30/1/ -- idea and implementation concept.
 * 
 * A jQuery plugin that allows easy removal of underlines from quotation marks that wrap anchors 
 * by changing DOM structure, e.g.:
 * <a>«foo»</a> → <a>«<span>foo</span>»</a>
 * where <a> has `text-decoration: none` and <span> has `text-decoration: underline`.
 * 
 * It can also
 *	1) invert anchors: «<a>foo</a>» → <a>«foo»</a> (required for proper removal of underlines)
 *		it does this while preserving attributes of elements that wrap the quotes.
 *	2) add relevant styles for underlined links;
 *	3) accept other chars besides default «», „“, ().
 *	4) ignore anchors with a specified class;
 *	5) ignore anchors that will break the algorithm:
 *		a) <a><span>« and something else</span> in anchor</a>
 *		b) <a> and its children containing attributes or data-attributes with «, », etc.
 *
 * USAGE:
 * One of these ways or their combination: 
 * 
 * $(document).birmanizeAnchors(); 
 * $(document).birmanizeAnchors(true);        // add styles (only for underlines)
 * $(document).birmanizeAnchors(options);     // see below for available options
 * $(".container").birmanizeAnchors();        // limit scope by container
 *
 * If you use text-decoration: underline for anchors the most straightforward way 
 * to use AnchorBirmanizer is to call it as `$(document).birmanizeAnchors(true)`. 
 * Otherwise just add the following to CSS: 
 * .birmanized-anchor-within-quotes { 
 *		text-decoration: underline; 
 *		}
 * .birmanized-anchor { 
 *		text-decoration: none !important;  
 *		}
 *		
 * If you use border-bottom, add:
 * .birmanized-anchor {
				border-bottom: none;
				}
 * and `, [selector] .birmanized-anchor-within-quotes` to each selector that defines rules
 * of border-bottom anchor underlines.
 * 
 * Settings and default values: see below
 *		
 * LIMITATIONS: 
 * These cases are ignored:
 *	1. Triggering characters are inside elements that contain other characters:
 *		<a><span>«foo</span> bar»</span> (and the same for closing character)
 *	2. Anchor or its children have an attribute or data-attribute with a triggering 
 *	character as a value:
 *		<a><span data-content="«">«</span>foo</a>
 *	
 * Unsupported browsers:
 * IE < 9
 * 
 * LICENSE: 
 * Dual licensed under the MIT and GPL licenses:
 * http://www.opensource.org/licenses/mit-license.php
 * http://www.gnu.org/licenses/gpl.html
 * 
 */

(function ($) {
	jQuery.fn.birmanizeAnchors = function (options) {				
		var birmanizer = this;

		if (typeof(options) == 'boolean' || typeof(options) == 'undefined') {
			options = {doAddStyle: options}; 
			}
		var birmanizerSettings = $.extend({
			// Chars that trigger the birmanization. Paired characters must have same indices. 
			charsOpening          : ['«', '„', '('],
			charsClosing          : ['»', '“', ')'],

			// Name of the class added to birmanized anchor
			nameClass             : 'birmanized-anchor',

			// Name of class of <span> within quotes inside the birmanized anchor:
			// <a>«<span class="foo">bar</span>»</a>
			nameClassWithinQuotes : 'birmanized-anchor-within-quotes',
			
			// «<a>foo</a>» → <a>«foo»</a>
			// Neccessary for birmanization of such anchors
			doInvert              : true,
			
			// Adds underlines to added inner spans and removes them from proccessed anchors.
			// The styles are generated and are appended to <body> in a <style> block
 			doAddStyle            : false,

			// Anchors with these classes won't be processed
			classesIgnored        : []
	        }, options);
			
		$.extend(birmanizer, birmanizerSettings);
		
		// If browser doesn't support Treewalker, stop
		if (typeof(document.createTreeWalker) == 'undefined') {
			return false
			}
		
		// Process anchors
		$("a", this).each(function() {
			// NOTE: in these comments "«" denotes a member of charsOpening and "»" denotes 
			// a member of charsClosing.
			
			var anchor = $(this);
			
			// Check if the class is ignored
			if (hasIgnoredClass(anchor)) {
				return true;
				}
				
			// Ignore <a> if it has elements that contain « or » in their attributes
			if (hasElementsWithOpeningOrClosingCharsInAttrsOrData(anchor)) {
				return true;
				}

			// Ignore empty <a>s
			if (!$.trim(anchor.text())) {
				return true;
				}
				
			// Invert anchors: «<a>foo</a>» → <a>foo</a>
			if (birmanizer.doInvert) {
				invertAnchor(anchor);
				}

			// Wrapping stuff: 
			// <a>«foo»</a> → 
			// <a class="birmanized-anchor>
			//     «
			//     <span class="birmanized-anchor-within-quotes">
			//         foo
			//     </span>
			//     »
			// </a>
			var htmlAfterWrap = wrapTextWithinQuotes(anchor);
			
			// Write result into DOM
			if (htmlAfterWrap) {
				anchor.addClass(birmanizer.nameClass);
				anchor.html(htmlAfterWrap);
				}
			})
			
		// Generate and append styles
		if (birmanizer.doAddStyle) {
			addStyle();
			}	
			
					
		// Main functions
		
		function invertAnchor(anchor) {
			// Inverting stuff: «<a>foo</a>» → <a>foo</a>
			// Uses TreeWalker to look at sibling nodes and see if they contain triggering 
			// chars, removes them and adds inside the anchor, or moves them inside if they 
			// are wrapped in elements (allows for keeping of said elements and their
			// styles).
			
			var nodeAnchor = anchor[0];
			if (isWrappedInQuotes(nodeAnchor.textContent)) {
				// If it's already in quotes, ignore it. «<a>„foo“</a>» should also be ignored
				return false;
				}
			
			// Check the surrounding nodes for opening and closing chars, e.g.:
			// [foo «]<a>bar</a>[» baz]
			// Assumes that <a> and the node containing the char are next and previous siblings.
			TreeWalker = createTreeWalker(document.body);
			
			// For previous sibling
			TreeWalker.currentNode = nodeAnchor;
			var nodePrev = TreeWalker.previousSibling(),
				hasOpening = false;
			if (nodePrev && nodePrev.textContent) {
				// If there's a previous node and if it has text content
				var charLast = nodePrev.textContent.slice(-1);
				if ($.inArray(charLast, birmanizer.charsOpening) > -1 ) {
					// If it's last char is '«'
					hasOpening = true;
					}
				}
				
			// For next sibling
			TreeWalker.currentNode = nodeAnchor; // reset treewalker
			var nodeNext = TreeWalker.nextSibling(), 
				hasClosing = false;
			if (nodeNext && nodeNext.textContent) {
				// If there's a next node and if it has text content
				var charFirst = nodeNext.textContent.charAt(0);
				if ($.inArray(charFirst, birmanizer.charsClosing) > -1 ) {
					// If it's first char is '»'
					hasClosing = true;
					}
				}
				
			// Actual inversion, incl. DOM manipulation
			if (hasOpening && hasClosing) {
				moveQuoteInsideAnchor(anchor, nodePrev, charLast, 'before');
				moveQuoteInsideAnchor(anchor, nodeNext, charFirst, 'after');
				}
			return true;
			
			function isWrappedInQuotes(str) {
				var indexOpening = $.inArray(str.charAt(0), birmanizer.charsOpening),
					indexClosing = $.inArray(str.slice(-1), birmanizer.charsClosing);
					
				if (indexOpening != -1 && indexClosing != -1     
				&& indexOpening == indexClosing) { 
				// if positions in config arrays are matching 
				// (e.g. "«" for charsOpening and "»" for charsClosing). 
					return true;
					}
				return false;
				}
			
			function moveQuoteInsideAnchor(a, node, chr, type) {
				// Does the actual moving (using different methods for unwrapped chars and
				// chars wrapped in elements.
				// `type` can be 'before' or 'after'
				
				var thingToMove = false; // node or chr to move inside the anchor
				
				if (node.nodeType == 1 && $(node).text() === chr) { 
					// If it's a « or » wrapped in an element, move the whole element node
					thingToMove = node;
					}
				else {
					// Otherwise, remove the quote character from the containing node,
					// i.e. remove the last (for prev) or first (for next) character
					// jQuery's text doesn't work with textNodes, so we use different
					// ways of getting and manipulating this character
					if (node.nodeType == 1) { 
						$(node).text(
							removeFirstOrLastChar($(node).text(), type)
							);
						}
					else if (node.nodeType == 3) { 
						node.nodeValue = removeFirstOrLastChar(node.nodeValue, type);
						}
					thingToMove = chr;
					}
					
				// Prepend or append element or character
				switch (type) {
					case 'before':
						a.prepend(thingToMove);
						break;
					case 'after':
						a.append(thingToMove);
						break;
					}

				function removeFirstOrLastChar(str, type) {
					switch (type) {
						case 'before':
							// Remove last char
							return str.slice(0, -1);
							break;
						case 'after':
							// Remove first char
							return str.slice(1);
							break;
						}
					}
				}
			}
			
		function wrapTextWithinQuotes(anchor) {
			// Wrapping stuff: 
			// <a>«foo»</a> → 
			// <a class="birmanized-anchor>
			//     «
			//     <span class="birmanized-anchor-within-quotes">
			//         foo
			//     </span>
			//     »
			// </a>	
			// 
			// Checks if first and last chars are paired triggering chars and then 
			
			var text      = anchor.text(),
				html      = anchor.html(),
				charFirst = text.charAt(0),
				charLast  = text.charAt(text.length - 1);

			// Check if its first char is "«" and its last char is "»"
			var indexOfFirstCharInConfigArray = $.inArray(charFirst, birmanizer.charsOpening),
				indexOfLastCharInConfigArray = $.inArray(charLast, birmanizer.charsClosing)
			if ((indexOfFirstCharInConfigArray === -1 || indexOfLastCharInConfigArray  === -1) 
				// If its missing one of the chars
				|| indexOfFirstCharInConfigArray !== indexOfLastCharInConfigArray  ) {
				// Of if the chars are not paired
				return false;
				}

			// Do acutal wrapping
			var elQuoteWrapper = false;
			try {
				elQuoteWrapper = isCharWrappedInElementAndIsFirstOrLastContainingText(charFirst, anchor, true);
				}
			catch (e){
				// Something besides opening « in first node with text
				return false;
				}
			if (elQuoteWrapper) {
				// If "«" is wrapped in an element, add opening <span> to the wrapper element in 
				// the HTML of anchor.
				// (e.g. <span>«</span> -> <span>«</span><span class="birmanized-anchor-within-quotes">)
				var htmlQuoteWrapper = outerHTML(elQuoteWrapper);
				html = html.replace(htmlQuoteWrapper, htmlQuoteWrapper + '<span class="' + birmanizer.nameClassWithinQuotes + '">');
				}
			else {
				// if "«" is not wrapped, insert <span> after "«"
				var posOpening = html.indexOf(charFirst);
				html = [
					html.slice(0, posOpening + 1), // start after the position of "«"
					'<span class="' + birmanizer.nameClassWithinQuotes + '">',
					html.slice(posOpening + 1),
					]
				.join('');
				}
				
			try {
				elQuoteWrapper = isCharWrappedInElementAndIsFirstOrLastContainingText(charLast, anchor, false);
				}
			catch (e){
				// Something besides closing » in last node with text
				return false;
				}
			if (elQuoteWrapper) {
				// If "»" is wrapped in an element, add </span> to this element in the HTML 
				// of anchor (e.g. <span>«</span> -> </span><span>«</span>)

				htmlQuoteWrapper = outerHTML(elQuoteWrapper);				
				html = html.replace(htmlQuoteWrapper, '</span>' + htmlQuoteWrapper);
				}
			else {
				// If "»" is not wrapped, insert </span> before "»"
				var posClosing = html.lastIndexOf(charLast);
				html = [
					html.slice(0, posClosing), 
					'</span>',
					html.slice(posClosing)
					]
				.join('');
				}
				
			// Return new html for writing into DOM (we can't do it on the fly, because 
			// browsers will add closing </span> when processing wrapped "«" and "»")
			return html;
			
			function isCharWrappedInElementAndIsFirstOrLastContainingText(chr, ancestor, isFirst) {
				// We know it has child nodes because we've previously checked whether 
				// <a> contained any text, and text nodes are always child nodes. (In 
				// our case, because we always have a containing element node -- the <a>)
				
				var TreeWalkerInside = createTreeWalker($(ancestor)[0]);
				
				if (!isFirst) { 
					// Set treewalker to last node, so we can then iterate backwards 
					while (TreeWalkerInside.nextNode()) {}; 
					}
				else {
					TreeWalkerInside.nextNode(); // Go inside the context element
					}
				var nodeCur = TreeWalkerInside.currentNode;
				
				// Iterate through nodes
				do {
					if (nodeCur.nodeValue) {                            // if the first node that contains text
						if (nodeCur.nodeValue === chr                   // contains only chr
						&& nodeCur.parentNode.nodeType === 1            // and it's parent is an element
						&& nodeCur.parentNode.childNodes.length === 1){ // that has only one child node
							// then we've got the char wrapped in an element
							return nodeCur.parentNode;
							}
						
						// Throw exceptions for spans containing « or » and something else
						if (nodeCur.parentNode != ancestor[0]) {  
							// If it's the not the direct child of anchor
							if (isFirst && $.inArray(nodeCur.nodeValue.charAt(0), birmanizer.charsOpening) > -1) {	
								throw "something besides opening « in first node with text";
								}
							if (!isFirst && $.inArray(nodeCur.nodeValue.slice(-1), birmanizer.charsClosing) > -1) {
								throw "something besides closing » in last node with text";
								}
							}
					
						// If the first node that contains text contains not chr or not only chr
						return false;
						}
					}
				while
					// Defines iteration direction
					(nodeCur = isFirst ? TreeWalkerInside.nextNode() : TreeWalkerInside.previousNode())
				return false;
				}	
			}
		
		function addStyle() {
			// Generates relevant styles and appends them to <body>
			// Haven't figured out how to deal with border-bottoms, so this is only for
			// `text-decoration: underline`
			
			var	styleRemove = "",
				styleAdd    = "";
					
			birmanizer.anchorStyle = 'underline'; // Until the 'border' case is figured out (see below)
			switch (birmanizer.anchorStyle) {
				case 'underline':
					styleAdd    = "text-decoration: underline";
					styleRemove = "text-decoration: none !important;";
					break;
				case 'border':
// 					TODO: this isn't working. See: http:// stackoverflow.com/questions/17686842/inherit-value-doesnt-inherit-from-visited-parent/
					styleAdd    = "border-bottom-width: 1px; " 
							+ "border-bottom-style: inherit; " 
					styleRemove = 'border-bottom-width: 0px !important; ';
					break;
				}
				
			$('body').append(
				'<style>\n\
					.' + birmanizer.nameClass + ' { ' + styleRemove + ' }\n\
					.' + birmanizer.nameClassWithinQuotes + ' { ' + styleAdd + ' }\n\
				</style>'
				);
			}
			
			
		//  Helper functions
		
		function createTreeWalker(nodeCtx) {
			var t= document.createTreeWalker(
				nodeCtx, 
				NodeFilter.SHOW_ALL,
				 function(node) {
					if (node.nodeType != 8) { // Ignore comments nodes
						return NodeFilter.FILTER_ACCEPT;
						}
					return NodeFilter.FILTER_REJECT;
					},
				true //  irrelevant, but required in IE.
				);
			return t;
			}
			
		function hasIgnoredClass(anchor) {
			var hasIgnoredClass = false;
			$.each(birmanizer.classesIgnored, function() {
				if (anchor.hasClass(this)) {
					hasIgnoredClass = true;
					}
				});
			return hasIgnoredClass;
			}
			
		function hasElementsWithOpeningOrClosingCharsInAttrsOrData(anchor) {
			// Searches for stuff like <span data-garbage="«">.
			// Includes the anchor itself.
			
			var els = $(anchor).find('*').andSelf(),
				result = false;
				
			els.each(function () {
				$.each($.extend({}, this.attributes, $(this).data()), function(index, attr){
					$.each(birmanizer.charsOpening.concat(birmanizer.charsClosing), function() {
						if (attr.value.indexOf(this) > -1)  {	
							result = true;
							}
						})
					});
				})
			return result;
			}
			
		function outerHTML(node){
			// http://stackoverflow.com/questions/1700870/how-do-i-do-outerhtml-in-firefox
			// If IE, Chrome take the internal method, otherwise build one (mostly for FF<22)
			return node.outerHTML || (
				function(n) {
					var div = document.createElement('div'), h;
					div.appendChild( n.cloneNode(true) );
					h = div.innerHTML;
					div = null;
					return h;
				})(node);
			}
		}
}(jQuery));