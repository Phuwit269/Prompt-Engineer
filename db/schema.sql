CREATE TYPE public.order_status AS ENUM (
    'pending',
    'paid',
    'cancelled'
);
CREATE TYPE public.role AS ENUM (
    'admin',
    'free',
    'pro'
);
CREATE TYPE public.subscription_status AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled'
);
CREATE TYPE public.tx_kind AS ENUM (
    'order',
    'subscription'
);
CREATE TYPE public.tx_status AS ENUM (
    'pending',
    'succeeded',
    'failed'
);
CREATE TABLE public.gamepasses (
    id integer NOT NULL,
    game_id integer NOT NULL,
    seller_id integer NOT NULL,
    name_en character varying(120) NOT NULL,
    name_th character varying(120) NOT NULL,
    description text NOT NULL,
    price numeric(10,2) NOT NULL,
    badge character varying(20),
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);
CREATE SEQUENCE public.gamepasses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.gamepasses_id_seq OWNED BY public.gamepasses.id;
CREATE TABLE public.games (
    id integer NOT NULL,
    name_en character varying(120) NOT NULL,
    name_th character varying(120) NOT NULL,
    category_en character varying(80) NOT NULL,
    category_th character varying(80) NOT NULL,
    accent integer NOT NULL,
    created_by integer,
    created_at timestamp without time zone NOT NULL
);
CREATE SEQUENCE public.games_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.games_id_seq OWNED BY public.games.id;
CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    gamepass_id integer NOT NULL,
    seller_id integer NOT NULL,
    gamepass_name character varying(255) NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    quantity integer NOT NULL,
    commission_rate numeric(5,4) NOT NULL,
    commission_amount numeric(10,2) NOT NULL
);
CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;
CREATE TABLE public.orders (
    id integer NOT NULL,
    buyer_id integer NOT NULL,
    total numeric(10,2) NOT NULL,
    commission_total numeric(10,2) NOT NULL,
    status public.order_status NOT NULL,
    created_at timestamp without time zone NOT NULL,
    paid_at timestamp without time zone
);
CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;
CREATE TABLE public.plans (
    id integer NOT NULL,
    code character varying(40) NOT NULL,
    name character varying(80) NOT NULL,
    price_thb numeric(10,2) NOT NULL,
    max_listings integer,
    commission_rate numeric(5,4) NOT NULL,
    duration_days integer NOT NULL
);
CREATE SEQUENCE public.plans_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.plans_id_seq OWNED BY public.plans.id;
CREATE TABLE public.subscriptions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    plan_id integer NOT NULL,
    status public.subscription_status NOT NULL,
    start_at timestamp without time zone,
    end_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL
);
CREATE SEQUENCE public.subscriptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.subscriptions_id_seq OWNED BY public.subscriptions.id;
CREATE TABLE public.transactions (
    id integer NOT NULL,
    user_id integer NOT NULL,
    kind public.tx_kind NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status public.tx_status NOT NULL,
    provider character varying(30) NOT NULL,
    reference character varying(40) NOT NULL,
    order_id integer,
    subscription_id integer,
    created_at timestamp without time zone NOT NULL,
    paid_at timestamp without time zone
);
CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;
CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    display_name character varying(80) NOT NULL,
    shop_name character varying(80),
    password_hash character varying(255) NOT NULL,
    role public.role NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);
CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.gamepasses ALTER COLUMN id SET DEFAULT nextval('public.gamepasses_id_seq'::regclass);
ALTER TABLE ONLY public.games ALTER COLUMN id SET DEFAULT nextval('public.games_id_seq'::regclass);
ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);
ALTER TABLE ONLY public.plans ALTER COLUMN id SET DEFAULT nextval('public.plans_id_seq'::regclass);
ALTER TABLE ONLY public.subscriptions ALTER COLUMN id SET DEFAULT nextval('public.subscriptions_id_seq'::regclass);
ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.gamepasses
    ADD CONSTRAINT gamepasses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_name_en_key UNIQUE (name_en);
ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);
ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_reference_key UNIQUE (reference);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
CREATE INDEX ix_gamepasses_game_id ON public.gamepasses USING btree (game_id);
CREATE INDEX ix_gamepasses_is_active ON public.gamepasses USING btree (is_active);
CREATE INDEX ix_gamepasses_seller_id ON public.gamepasses USING btree (seller_id);
CREATE INDEX ix_order_items_gamepass_id ON public.order_items USING btree (gamepass_id);
CREATE INDEX ix_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX ix_order_items_seller_id ON public.order_items USING btree (seller_id);
CREATE INDEX ix_orders_buyer_id ON public.orders USING btree (buyer_id);
CREATE INDEX ix_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE INDEX ix_transactions_status ON public.transactions USING btree (status);
CREATE INDEX ix_transactions_user_id ON public.transactions USING btree (user_id);
CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);
CREATE INDEX ix_users_role ON public.users USING btree (role);
ALTER TABLE ONLY public.gamepasses
    ADD CONSTRAINT gamepasses_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.games(id);
ALTER TABLE ONLY public.gamepasses
    ADD CONSTRAINT gamepasses_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.games
    ADD CONSTRAINT games_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_gamepass_id_fkey FOREIGN KEY (gamepass_id) REFERENCES public.gamepasses(id);
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_seller_id_fkey FOREIGN KEY (seller_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_buyer_id_fkey FOREIGN KEY (buyer_id) REFERENCES public.users(id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id);
ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id);
ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);
