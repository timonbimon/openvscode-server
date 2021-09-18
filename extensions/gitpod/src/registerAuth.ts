/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Gitpod. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/// <reference path='../../../src/vs/vscode.d.ts'/>

import ClientOAuth2 from 'client-oauth2';
import * as vscode from 'vscode';
import crypto from 'crypto';
import { GitpodExtensionContext } from 'gitpod-shared';

const authCompletePath = '/auth-complete';

export default function registerAuth(context: GitpodExtensionContext): void {
	async function resolveAuthenticationSession(data: any, resolveUser: any): Promise<vscode.AuthenticationSession> {
		const needsUserInfo = !data.account;
		const userInfo = needsUserInfo ? await resolveUser(data) : undefined;
		return {
			id: data.id,
			account: {
				label: data.account
					? data.account.label || data.account.displayName!
					: userInfo!.accountName,
				id: data.account?.id ?? userInfo!.id
			},
			scopes: data.scopes,
			accessToken: data.accessToken
		};
	}

	function hasScopes(session: vscode.AuthenticationSession, scopes?: readonly string[]): boolean {
		return !scopes || scopes.every(scope => session.scopes.includes(scope));
	}

	//#endregion

	//#region gitpod auth
	context.pendingActivate.push((async () => {
		const sessions: vscode.AuthenticationSession[] = [];
		const onDidChangeSessionsEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
		try {
			const resolveGitpodUser = async () => {
				const owner = await context.owner;
				return {
					id: owner.id,
					accountName: owner.name,
				};
			};
			if (vscode.env.uiKind === vscode.UIKind.Web) {
				const value = await context.secrets.get(`${vscode.env.uriScheme}-gitpod.login`);
				if (value) {
					const sessionData = JSON.parse(value);
					if (sessionData.length) {
						const session = await resolveAuthenticationSession(sessionData[0], resolveGitpodUser);
						sessions.push(session);
					}
				}
			} else {
				const scopes = [
					'function:accessCodeSyncStorage'
				];
				const baseURL = 'https://gitpod.io';

				const callbackUri = `${vscode.env.uriScheme}://gitpod.gitpod-desktop${authCompletePath}`;

				const stateConstant = crypto.randomBytes(32);
				const gitpodAuth = new ClientOAuth2({
					clientId: 'gplctl-1.0',
					clientSecret: 'gplctl-1.0-secret',
					accessTokenUri: `${baseURL}/api/oauth/token`,
					authorizationUri: `${baseURL}/api/oauth/authorize`,
					redirectUri: callbackUri,
					scopes: scopes,
					state: stateConstant.toString('hex')
				});

				// Store the state in the secrets store (for checking later)
				await context.secrets.store(`${vscode.env.uriScheme}-gitpod.state`, stateConstant.toString('hex'));

				// Open the authorization URL in the default browser
				await vscode.env.openExternal(vscode.Uri.parse(gitpodAuth.code.getUri()));

			}
		} catch (e) {
			console.error('Failed to restore Gitpod session:', e);
		}
		context.subscriptions.push(onDidChangeSessionsEmitter);
		context.subscriptions.push(vscode.authentication.registerAuthenticationProvider('gitpod', 'Gitpod', {
			onDidChangeSessions: onDidChangeSessionsEmitter.event,
			getSessions: scopes => {
				if (!scopes) {
					return Promise.resolve(sessions);
				}
				return Promise.resolve(sessions.filter(session => hasScopes(session, scopes)));
			},
			createSession: async () => {
				// Todo: implement logging in
				throw new Error('not supported');
			},
			removeSession: async () => {
				// Todo: implement logging out
				throw new Error('not supported');
			},
		}, { supportsMultipleAccounts: false }));
	})());
	//#endregion gitpod auth
}
