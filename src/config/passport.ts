import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "mock_client_id_for_testing",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock_client_secret_for_testing",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0].value;
        const name = profile.displayName || "Camply User";
        const avatar = profile.photos?.[0].value;

        if (!email) {
          return done(new Error("No email provided by Google"), false);
        }

        // Check if user with googleId exists
        let user = await prisma.user.findUnique({ where: { googleId } });

        if (user) {
          return done(null, user as any);
        }

        // Check if user with email exists
        user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // Link googleId to existing account
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
          return done(null, user as any);
        }

        // Generate a unique username
        let username = name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!username) username = "user" + Math.floor(Math.random() * 10000);
        
        let usernameExists = await prisma.user.findUnique({ where: { username } });
        let suffix = 1;
        const baseUsername = username;
        while (usernameExists) {
          username = `${baseUsername}${suffix}`;
          usernameExists = await prisma.user.findUnique({ where: { username } });
          suffix++;
        }

        // Create new user
        user = await prisma.user.create({
          data: {
            name,
            email,
            username,
            googleId,
            avatar,
            passwordHash: null, // No password for OAuth users
          },
        });

        return done(null, user as any);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
