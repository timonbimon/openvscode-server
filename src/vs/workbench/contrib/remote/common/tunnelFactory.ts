/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ITunnelService, TunnelOptions, RemoteTunnel, TunnelCreationOptions, ITunnel, TunnelProtocol } from 'vs/platform/remote/common/tunnel';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IRemoteExplorerService } from 'vs/workbench/services/remote/common/remoteExplorerService';
import { ILogService } from 'vs/platform/log/common/log';

export class TunnelFactoryContribution extends Disposable implements IWorkbenchContribution {

	constructor(
		@ITunnelService tunnelService: ITunnelService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
		@IRemoteExplorerService remoteExplorerService: IRemoteExplorerService,
		@ILogService logService: ILogService
	) {
		super();
		const tunnelFactory = environmentService.options?.tunnelProvider?.tunnelFactory;
		if (tunnelFactory) {
			this._register(tunnelService.setTunnelProvider({
				forwardPort: (tunnelOptions: TunnelOptions, tunnelCreationOptions: TunnelCreationOptions): Promise<RemoteTunnel | undefined> | undefined => {
					let tunnelPromise: Promise<ITunnel> | undefined;
					try {
						tunnelPromise = tunnelFactory(tunnelOptions, tunnelCreationOptions);
					} catch (e) {
						logService.trace('tunnelFactory: tunnel provider error');
					}

					return new Promise(async (resolve) => {
						if (!tunnelPromise) {
							resolve(undefined);
							return;
						}
						let tunnel: ITunnel;
						try {
							tunnel = await tunnelPromise;
						} catch (e) {
							logService.trace('tunnelFactory: tunnel provider promise error');
							resolve(undefined);
							return;
						}
						tunnel.onDidDispose(() => {
							remoteExplorerService.close(tunnel.remoteAddress);
						});
						const localAddress = tunnel.localAddress.startsWith('http') ? tunnel.localAddress : `http://${tunnel.localAddress}`;
						const remoteTunnel: RemoteTunnel = {
							tunnelRemotePort: tunnel.remoteAddress.port,
							tunnelRemoteHost: tunnel.remoteAddress.host,
							localAddress,
							public: !!tunnel.public,
							protocol: tunnel.protocol ?? TunnelProtocol.Http,
							dispose: async () => { await tunnel.dispose(); }
						};
						resolve(remoteTunnel);
					});
				}
			}, environmentService.options?.tunnelProvider?.features ?? { elevation: false, public: false }));
			remoteExplorerService.setTunnelInformation(undefined);
		}
	}
}
