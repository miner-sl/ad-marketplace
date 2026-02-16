start transaction ;
create table if not exists users
(
    id               serial
        primary key,
    telegram_id      bigint not null
        unique,
    username         varchar(255),
    first_name       varchar(255),
    last_name        varchar(255),
    is_channel_owner boolean   default false,
    is_advertiser    boolean   default false,
    created_at       timestamp default CURRENT_TIMESTAMP,
    updated_at       timestamp default CURRENT_TIMESTAMP,
    wallet_address   varchar(255),
    photo_url        varchar(500),
    language_code    varchar(10),
    is_premium       boolean   default false
);

alter table users
    owner to admarketplace;

create index if not exists idx_users_telegram_id
    on users (telegram_id);

create unique index if not exists idx_users_username_unique
    on users (username)
    where (username IS NOT NULL);

create unique index if not exists idx_users_telegram_id_unique
    on users (telegram_id)
    where (telegram_id IS NOT NULL);

create table if not exists campaigns
(
    id                     serial
        primary key,
    advertiser_id          integer      not null
        references users
            on delete cascade,
    title                  varchar(500) not null,
    description            text,
    budget_ton             numeric(20, 9),
    target_subscribers_min integer,
    target_subscribers_max integer,
    target_views_min       integer,
    target_languages       jsonb,
    preferred_formats      jsonb,
    status                 varchar(50) default 'draft'::character varying,
    created_at             timestamp   default CURRENT_TIMESTAMP,
    updated_at             timestamp   default CURRENT_TIMESTAMP
);

alter table campaigns
    owner to admarketplace;

create index if not exists idx_campaigns_advertiser_id
    on campaigns (advertiser_id);

create index if not exists idx_campaigns_status
    on campaigns (status);

create table if not exists schema_migrations
(
    id          serial
        primary key,
    filename    varchar(255) not null
        unique,
    executed_at timestamp default CURRENT_TIMESTAMP
);

alter table schema_migrations
    owner to admarketplace;

create table if not exists topics
(
    id          serial
        primary key,
    name        varchar(255) not null
        unique,
    description text,
    created_at  timestamp default CURRENT_TIMESTAMP,
    updated_at  timestamp default CURRENT_TIMESTAMP
);

alter table topics
    owner to admarketplace;

create table if not exists channels
(
    id                  serial
        primary key,
    owner_id            integer not null
        references users
            on delete cascade,
    telegram_channel_id bigint  not null
        unique,
    username            varchar(255),
    title               varchar(500),
    description         text,
    bot_admin_id        bigint,
    is_verified         boolean   default false,
    is_active           boolean   default true,
    created_at          timestamp default CURRENT_TIMESTAMP,
    updated_at          timestamp default CURRENT_TIMESTAMP,
    topic_id            integer
                                references topics
                                    on delete set null,
    country             varchar(255),
    locale              varchar(10)
);

alter table channels
    owner to admarketplace;

create index if not exists idx_channels_owner_id
    on channels (owner_id);

create index if not exists idx_channels_telegram_id
    on channels (telegram_channel_id);

create index if not exists idx_channels_topic_id
    on channels (topic_id);

create unique index if not exists idx_channels_username_unique
    on channels (username)
    where (username IS NOT NULL);

create unique index if not exists idx_channels_telegram_channel_id_unique
    on channels (telegram_channel_id)
    where (telegram_channel_id IS NOT NULL);

create table if not exists channel_managers
(
    id               serial
        primary key,
    channel_id       integer not null
        references channels
            on delete cascade,
    user_id          integer not null
        references users
            on delete cascade,
    telegram_user_id bigint  not null,
    permissions      jsonb     default '{}'::jsonb,
    is_active        boolean   default true,
    created_at       timestamp default CURRENT_TIMESTAMP,
    unique (channel_id, telegram_user_id)
);

alter table channel_managers
    owner to admarketplace;

create table if not exists channel_stats
(
    id                        serial
        primary key,
    channel_id                integer not null
        references channels
            on delete cascade,
    subscribers_count         integer,
    average_views             integer,
    average_reach             integer,
    language_distribution     jsonb,
    premium_subscribers_count integer,
    statistic                 jsonb,
    stats_date                timestamp default CURRENT_TIMESTAMP,
    created_at                timestamp default CURRENT_TIMESTAMP
);

alter table channel_stats
    owner to admarketplace;

create index if not exists idx_channel_stats_channel_id
    on channel_stats (channel_id);

create table if not exists channel_pricing
(
    id         serial
        primary key,
    channel_id integer        not null
        references channels
            on delete cascade,
    ad_format  varchar(50)    not null,
    price_ton  numeric(20, 9) not null,
    currency   varchar(10) default 'TON'::character varying,
    is_active  boolean     default true,
    created_at timestamp   default CURRENT_TIMESTAMP,
    updated_at timestamp   default CURRENT_TIMESTAMP,
    unique (channel_id, ad_format)
);

alter table channel_pricing
    owner to admarketplace;

create table if not exists channel_listings
(
    id          serial
        primary key,
    channel_id  integer not null
        references channels
            on delete cascade,
    title       varchar(500),
    description text,
    is_active   boolean   default true,
    created_at  timestamp default CURRENT_TIMESTAMP,
    updated_at  timestamp default CURRENT_TIMESTAMP
);

alter table channel_listings
    owner to admarketplace;

create table if not exists deals
(
    id                            serial
        primary key,
    deal_type                     varchar(50)           not null,
    listing_id                    integer
                                                        references channel_listings
                                                            on delete set null,
    campaign_id                   integer
                                                        references campaigns
                                                            on delete set null,
    channel_id                    integer               not null
        references channels
            on delete cascade,
    channel_owner_id              integer               not null
        references users
            on delete cascade,
    advertiser_id                 integer               not null
        references users
            on delete cascade,
    ad_format                     varchar(50)           not null,
    price_ton                     numeric(20, 9)        not null,
    status                        varchar(50) default 'pending'::character varying,
    escrow_address                varchar(255),
    payment_tx_hash               varchar(255),
    payment_confirmed_at          timestamp,
    scheduled_post_time           timestamp,
    actual_post_time              timestamp,
    post_message_id               bigint,
    post_verification_until       timestamp,
    created_at                    timestamp   default CURRENT_TIMESTAMP,
    updated_at                    timestamp   default CURRENT_TIMESTAMP,
    channel_owner_wallet_address  varchar(255),
    first_publication_time        timestamp,
    min_publication_duration_days integer     default 7 not null,
    decline_reason                varchar(255),
    refund_tx_hash                varchar(255)
);

alter table deals
    owner to admarketplace;

create index if not exists idx_deals_channel_id
    on deals (channel_id);

create index if not exists idx_deals_advertiser_id
    on deals (advertiser_id);

create index if not exists idx_deals_status
    on deals (status);

create index if not exists idx_deals_scheduled_post_time
    on deals (scheduled_post_time);

create unique index if not exists idx_deals_unique_payment_tx_hash
    on deals (id, payment_tx_hash)
    where (payment_tx_hash IS NOT NULL);

create unique index if not exists idx_deals_unique_post_message_id
    on deals (id, post_message_id)
    where (post_message_id IS NOT NULL);

create table if not exists deal_messages
(
    id           serial
        primary key,
    deal_id      integer not null
        references deals
            on delete cascade,
    sender_id    integer not null
        references users
            on delete cascade,
    message_text text    not null,
    created_at   timestamp default CURRENT_TIMESTAMP
);

alter table deal_messages
    owner to admarketplace;

create table if not exists creatives
(
    id             serial
        primary key,
    deal_id        integer     not null
        references deals
            on delete cascade,
    submitted_by   integer     not null
        references users
            on delete cascade,
    content_type   varchar(50) not null,
    content_data   jsonb       not null,
    status         varchar(50) default 'draft'::character varying,
    revision_notes text,
    created_at     timestamp   default CURRENT_TIMESTAMP,
    updated_at     timestamp   default CURRENT_TIMESTAMP
);

alter table creatives
    owner to admarketplace;

create table if not exists post_verifications
(
    id                  serial
        primary key,
    deal_id             integer not null
        references deals
            on delete cascade,
    verified_at         timestamp default CURRENT_TIMESTAMP,
    post_exists         boolean,
    post_unchanged      boolean,
    message_id          bigint,
    verification_result jsonb
);

alter table post_verifications
    owner to admarketplace;

create table if not exists escrow_wallets
(
    id                   serial
        primary key,
    deal_id              integer      not null
        unique
        references deals
            on delete cascade,
    address              varchar(255) not null
        unique,
    mnemonic_encrypted   text         not null,
    secret_key_encrypted text         not null,
    public_key           varchar(255) not null,
    created_at           timestamp default CURRENT_TIMESTAMP,
    updated_at           timestamp default CURRENT_TIMESTAMP
);

alter table escrow_wallets
    owner to admarketplace;

create index if not exists idx_escrow_wallets_deal_id
    on escrow_wallets (deal_id);

create index if not exists idx_escrow_wallets_address
    on escrow_wallets (address);

create table if not exists ledger_entries
(
    id            bigserial
        primary key,
    deal_id       integer
                                 references deals
                                     on delete set null,
    from_address  varchar(255),
    to_address    varchar(255),
    amount        numeric(20, 9) not null
        constraint ledger_entries_amount_check
            check (amount > (0)::numeric),
    direction     varchar(20)    not null
        constraint ledger_entries_direction_check
            check ((direction)::text = ANY ((ARRAY ['in'::character varying, 'out'::character varying])::text[])),
    entry_type    varchar(50)    not null
        constraint ledger_entries_entry_type_check
            check ((entry_type)::text = ANY
                   ((ARRAY ['deposit'::character varying, 'payment_to_escrow'::character varying, 'release_to_owner'::character varying, 'refund_to_advertiser'::character varying, 'platform_fee'::character varying, 'withdrawal'::character varying, 'correction'::character varying])::text[])),
    tx_hash       varchar(255),
    confirmations integer                  default 0,
    status        varchar(20)              default 'pending'::character varying
        constraint ledger_entries_status_check
            check ((status)::text = ANY
                   ((ARRAY ['pending'::character varying, 'confirmed'::character varying, 'failed'::character varying, 'reversed'::character varying])::text[])),
    created_at    timestamp with time zone default CURRENT_TIMESTAMP,
    confirmed_at  timestamp with time zone,
    metadata      jsonb
);

alter table ledger_entries
    owner to admarketplace;

create index if not exists idx_ledger_deal_id
    on ledger_entries (deal_id);

create index if not exists idx_ledger_tx_hash
    on ledger_entries (tx_hash);

create index if not exists idx_ledger_from_address
    on ledger_entries (from_address);

create index if not exists idx_ledger_to_address
    on ledger_entries (to_address);

create index if not exists idx_ledger_entry_type
    on ledger_entries (entry_type);

create index if not exists idx_ledger_status
    on ledger_entries (status);

create index if not exists idx_ledger_created_at
    on ledger_entries (created_at);


commit ;
