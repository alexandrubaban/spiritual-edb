/**
 * Utilities for the UpdateManager.
 */
edb.UpdateAssistant = {

	/**
	 * @static
	 * Get ID for element.
	 * @param {Element} element
	 * @returns {String}
	 */
	id : function ( element ) {

		return gui.Type.isDefined ( element.id ) ? 
			element.id || null : 
			element.getAttribute ( "id" ) || null;
	},

	/**
	 * @static
	 * Parse markup to element.
	 * TODO: Use DOMParser versus "text/html" for browsers that support it?
	 * TODO: All sorts of edge cases for IE6 compatibility. Hooray for HTML5.
	 * TODO: Evaluate well-formedness in debug mode for XHTML documents.
	 * @param {Document} doc
	 * @param {String} markup
	 * @param {String} id
	 * @param {Element} element
	 * @returns {Element}
	 */
	parse : function ( doc, markup, id, element ) { // gonna need to know the parent element type here...

		element = doc.createElement ( element.localName );
		element.innerHTML = markup;
		element.id = id;

		/*
		 * TODO: Plugin this!
		 */
		Array.forEach ( element.querySelectorAll ( "option" ), function ( option ) {
			switch ( option.getAttribute ( "selected" )) {
				case "true" :
					option.setAttribute ( "selected", "selected" );
					break;
				case "false" :
					option.removeAttribute ( "selected" );
					break;
			}
		});

		/*
		 * TODO: Plugin this!
		 */
		Array.forEach ( element.querySelectorAll ( "input[type=checkbox],input[type=radio]" ), function ( option ) {
			switch ( option.getAttribute ( "checked" )) {
				case "true" :
					option.setAttribute ( "checked", "checked" );
					break;
				case "false" :
					option.removeAttribute ( "checked" );
					break;
			}
		});

		return element;
	},

	/**
	 * @static
	 * Mapping element id to it's ordinal position.
	 * @returns {Map<String,number>}
	 */
	order : function ( nodes ) {
		
		var order = new Map ();
		Array.forEach ( nodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				order.set ( this.id ( node ), index );
			}
		}, this );
		return order;
	},
	
	/**
	 * @static
	 * Convert an NodeList into an ID-to-element map.
	 * @param {NodeList} nodes
	 * @return {Map<String,Element>}
	 */
	index : function ( nodes ) {
		
		var result = Object.create ( null );
		Array.forEach ( nodes, function ( node, index ) {
			if ( node.nodeType === Node.ELEMENT_NODE ) {
				result [ this.id ( node )] = node;
			}
		}, this );
		return result;
	}	
};