edb.Tag = {

	/**
	 * 
	 */
	get : function ( win, tag ) {
		var sig = win.gui.signature;
		var all = this._all;
		var src = all [ sig ][ tag ];
		return edb.Function.get ( src, win );
	},
	
	/**
	 * 
	 */	
	set : function ( win, tag, src ) {
		var sig = win.gui.signature;
		var all = this._all;
		all [ sig ] = all [ sig ] || Object.create ( null );
		all [ sig ][ tag ] = src;
	},

	/**
	 * 
	 */
	_all : Object.create ( null )
};