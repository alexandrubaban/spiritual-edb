edb.Relay = ( function () {

	return {

		synchronize : function ( type ) {
			type.addObserver ( this );
			var x = {
				onbroadcast : function ( b ) {
					var changes = b.data;
					if ( changes.some ( function ( c ) {
						return c.$instanceid !== type.$instanceid;
					})) {
						changes.forEach ( function ( c ) {
							if ( type [ c.name ] !== c.newValue ) {
								type.$synchronizing = true;
								type [ c.name ] = c.newValue;
							}
						});
					}
				}
			};
			gui.Broadcast.add ( type.$originalid || type.$instanceid, x );		
		},

		/**
		 * 
		 * @param {Array<edb.ObjectChange>} changes
		 */
		onchange : function ( changes ) {
			var summary = {};
			var syncing = {};
			changes.forEach ( function ( c ) {
				var type = c.object;
				if ( type.$synchronizing ) {
					syncing [ type.$instanceid ] = type;
				} else {
					var aaa = gui.Object.copy ( c );
					delete aaa.object;
					aaa.$instanceid = type.$instanceid;
					var id = type.$originalid || type.$instanceid;
					summary [ id ] = summary [ id ] || [];
					summary [ id ].push ( aaa );
				}
			});
			gui.Object.each ( summary, function ( id, cs ) {
				gui.Broadcast.dispatch ( null, id, cs );
			});
			gui.Object.each ( syncing, function ( id, type ) {
				type.$synchronizing = false;
			});
		}
	};

}());