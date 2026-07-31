# OAuth vs Oidc

When you use "Log in with Facebook," Facebook actually uses a modified, proprietary version of OAuth 2.0 to handle identity, rather than the strict OIDC standard.

Here is the breakdown of how they differ and how they work together.
# The Core Difference OAuth 2.0 (The Foundation): 

- It is a framework designed to give an application an Access Token to perform actions on behalf of a user (like reading tweets or posting to Facebook). It does not natively provide user profile details.

- OIDC / OpenID Connect (The Identity Layer): It is an extension built on top of OAuth 2.0. It standardizes the login process and introduces an ID Token, which explicitly contains the user's identity details (name, email, profile picture) in a secure format

# OAuth Flow:

## OAuth connects a user's third-party account (like Meta or Twitter) to your application securely without sharing passwords. The Authorization Code flow:
- Your app redirects the user to the provider's login page.
- The user grants access.The provider redirects the user back with an auth code.
- Your server swaps the code for an API access token.

The setup and implementation for both platforms require specific configurations and endpoints.
## App RegistrationBefore coding, you must register your app on the developer portals to obtain a Client ID and Client Secret:
* Meta (Facebook/Instagram): Go to the Meta for Developers dashboard to create a new app and enable Facebook Login. Add your specific redirect URI (e.g., https://yourdomain.com).
* Twitter (X): Go to the Twitter Developer Portal to create a Project & App. Enable OAuth 2.0 with Authorization Code with PKCE for enhanced security, and set your callback URL.