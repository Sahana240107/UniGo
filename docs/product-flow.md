# UniGo Product Flow

## Login

1. User signs in with Supabase Auth.
2. App checks whether the user belongs to an active daily commute group.
3. If the user is already in a daily commute group, ask: "Are you coming today?"
4. If yes, show Join Ride and Create Ride actions.

## Create Ride

1. Detect current location.
2. Show the pickup location on a Leaflet map.
3. Allow the user to correct the pickup pin.
4. Ask for drop location.
5. Show location suggestions using free map services.
6. Draw the route from pickup to drop using OpenRouteService.
7. Show distance, estimated duration, and matching riders.

## Join Ride

1. Select pickup and drop.
2. Show riders already going on the same route, before the pickup, or after the drop.
3. Allow filtering to women-only rides.
4. Join a ride and receive live status over WebSockets.

