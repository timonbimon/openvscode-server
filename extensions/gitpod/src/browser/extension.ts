/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../../src/vs/vscode.d.ts'/>

import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext) {
	const output = vscode.window.createOutputChannel('Gitpod');
	function log(value: string) {
		output.appendLine(`[${new Date().toLocaleString()}] ${value}`);
	}

	const authCompletePath = '/auth-complete';
	context.subscriptions.push(vscode.window.registerUriHandler({
		handleUri: async uri => {
			if (uri.path === authCompletePath) {
				log('auth completed');
				return;
			}
			log(`open workspace window: ${uri.toString()}`);
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('gitpod.api.auth', async () => {
		log('Executing auth command');
		context.subscriptions.push(
			vscode.commands.registerCommand(`gitpod.api.signin`, async () => {
				// Get an externally addressable callback URI for the handler that the authentication provider can use
				const callbackUri = await vscode.env.asExternalUri(
					vscode.Uri.parse(`${vscode.env.uriScheme}://gitpod/auth-complete`)
				);

				vscode.env.clipboard.writeText(callbackUri.toString());
				await vscode.window.showInformationMessage(
					'Open the URI copied to the clipboard in a browser window to authorize.'
				);
			})
		);
	}));
}

export function deactivate() { }
