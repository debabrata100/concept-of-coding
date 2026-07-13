# ID Token vs Access Token
An ID token proves who the user is (Authentication), while an access token proves what the user is allowed to do (Authorization)

Here is a quick breakdown of how they differ:
ID Token: Answers "Who are you?
-  "Purpose: Contains user profile information (e.g., name, email, picture) so your client application can personalize the user experience (e.g., "Welcome back, John").
-  Recipient: Always consumed by the client application. Never send an ID token to a backend API or server.
-  Format: Always a JSON Web Token (JWT).

Access Token: Answers "Are you allowed to do this?
 - "Purpose: Grants the app permission to perform specific actions on behalf of the user, such as reading a calendar or updating a profile.
 - Recipient: Consumed by the Resource Server / API. The client application simply passes it along without inspecting its contents.
- Format: Can be a JWT or an opaque random string depending on the server implementation