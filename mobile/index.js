import { registerRootComponent } from "expo";
// Importing this module defines the background geofence task in the global
// scope, which must happen before the app registers (Expo TaskManager rule).
import "./src/geofence";
import App from "./App";

registerRootComponent(App);
