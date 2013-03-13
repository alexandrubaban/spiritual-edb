/**
 * Converts JS props to HTML attributes during EDBML rendering phase. 
 * Any methods added to this prototype will become available in EDBML 
 * scripts as: att.mymethod() TODO: How can Att instances be passed?
 * @param @optional Map<String,object> atts Default properties
 */
edb.Att = function Att ( atts ) {
	if ( atts ) {
		gui.Object.extend ( this, atts );
	}
};

edb.Att.prototype = gui.Object.create ( null, {

	/**
	 * Identification.
	 * @returns {String}
	 */
	toString : function () {
		return "[object edb.Att]";
	},

	/**
	 * Resolve key-value to HTML attribute declaration.
	 * @todo Rename "_html"
	 * @param {String} att
	 * @returns {String} 
	 */
	_out : function ( att ) {
		var val, html = "";
		if ( gui.Type.isDefined ( this [ att ])) {
			val = edb.Att.encode ( this [ att ]);
			html += att + "=\"" + val + "\" ";
		}
		return html;
	},

	/**
	 * Resolve key-value, then delete it to prevent reuse.
	 * @param {String} att
	 */
	_pop : function ( att ) {
		var html = this._out ( att );
		delete this [ att ];
		return html;
	},

	/**
	 * Resolve all key-values to HTML attribute declarations.
	 * @returns {String} 
	 */
	_all : function () {
		var html = "";
		gui.Object.nonmethods ( this ).forEach ( function ( att ) {
			html += this._out ( att );
		}, this );
		return html;
	}

});

/**
 * @static
 * Stringify stuff to be used as HTML attribute values.
 * @param {object} data
 * @returns {String}
 */
edb.Att.encode = function ( data ) {
	var type = gui.Type.of ( data );
	switch ( type ) {
		case "string" :
			break;
		case "number" :
		case "boolean" :
			data = String ( data );
			break;
		case "object" :
		case "array" :
			try {
				data = encodeURIComponent ( JSON.stringify ( data ));
			} catch ( jsonex ) {
				throw new Error ( "Could not create HTML attribute: " + jsonex );
			}
			break;
		case "date" :
			throw new Error ( "TODO: edb.Att.encode standard date format?" );
		default :
			throw new Error ( "Could not create HTML attribute for " + type );
	}
	return data;
};