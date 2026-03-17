import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const USERS = [
  { id: "1", name: "Mehrad",   username: "mehrad",   password: "mkfrm2024"    },
  { id: "2", name: "Trader1",  username: "trader1",  password: "trade2024"    },
  { id: "3", name: "Trader2",  username: "trader2",  password: "trade2024"    },
  { id: "4", name: "Analyst",  username: "analyst",  password: "analyst2024"  },
  { id: "5", name: "Joe",      username: "joe",      password: "joe2024"      },
  { id: "6", name: "Gestler",  username: "gestler",  password: "gestler2024"  },
];

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = USERS.find(
          (u) =>
            u.username === credentials?.username &&
            u.password === credentials?.password
        );
        if (!user) return null;
        return { id: user.id, name: user.name };
      },
    }),
  ],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
