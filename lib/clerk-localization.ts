import type { NextClerkProviderProps } from "@clerk/nextjs/types"

import type { Locale } from "@/i18n/routing"

type ClerkLocalization = NonNullable<NextClerkProviderProps["localization"]>

const etEE = {
  locale: "et-EE",
  backButton: "Tagasi",
  dividerText: "või",
  footerActionLink__alternativePhoneCodeProvider: "Saada kood SMS-iga",
  footerActionLink__useAnotherMethod: "Kasuta muud viisi",
  footerPageLink__help: "Abi",
  footerPageLink__privacy: "Privaatsus",
  footerPageLink__terms: "Tingimused",
  formButtonPrimary: "Jätka",
  formButtonPrimary__verify: "Kinnita",
  formFieldAction__forgotPassword: "Unustasid parooli?",
  formFieldError__matchingPasswords: "Paroolid kattuvad.",
  formFieldError__notMatchingPasswords: "Paroolid ei kattu.",
  formFieldError__verificationLinkExpired:
    "Kinnituslink on aegunud. Taotle uus link.",
  formFieldHintText__optional: "Valikuline",
  formFieldHintText__slug:
    "Lühinimi on ainulaadne ja loetav tunnus, mida kasutatakse sageli veebiaadressides.",
  formFieldInputPlaceholder__backupCode: "Sisesta varukood",
  formFieldInputPlaceholder__confirmDeletionUserAccount: "Kustuta konto",
  formFieldInputPlaceholder__emailAddress: "Sisesta e-posti aadress",
  formFieldInputPlaceholder__emailAddress_username:
    "Sisesta e-posti aadress või kasutajanimi",
  formFieldInputPlaceholder__emailAddresses: "nimi@naide.ee, teine@naide.ee",
  formFieldInputPlaceholder__firstName: "Eesnimi",
  formFieldInputPlaceholder__lastName: "Perekonnanimi",
  formFieldInputPlaceholder__organizationDomain: "naide.ee",
  formFieldInputPlaceholder__organizationDomainEmailAddress: "sina@naide.ee",
  formFieldInputPlaceholder__organizationName: "Töökoha nimi",
  formFieldInputPlaceholder__organizationSlug: "minu-tookoht",
  formFieldInputPlaceholder__password: "Sisesta parool",
  formFieldInputPlaceholder__phoneNumber: "Sisesta telefoninumber",
  formFieldInputPlaceholder__signUpPassword: "Loo parool",
  formFieldInputPlaceholder__username: "Sisesta kasutajanimi",
  formFieldInput__emailAddress_format: "Näide: nimi@naide.ee",
  formFieldLabel__automaticInvitations:
    "Luba selle domeeni kasutajatele automaatsed kutsed",
  formFieldLabel__backupCode: "Varukood",
  formFieldLabel__confirmDeletion: "Kinnitus",
  formFieldLabel__confirmPassword: "Kinnita parool",
  formFieldLabel__currentPassword: "Praegune parool",
  formFieldLabel__emailAddress: "E-posti aadress",
  formFieldLabel__emailAddress_username: "E-posti aadress või kasutajanimi",
  formFieldLabel__emailAddresses: "E-posti aadressid",
  formFieldLabel__firstName: "Eesnimi",
  formFieldLabel__lastName: "Perekonnanimi",
  formFieldLabel__newPassword: "Uus parool",
  formFieldLabel__organizationDomain: "Domeen",
  formFieldLabel__organizationName: "Nimi",
  formFieldLabel__organizationSlug: "Lühinimi",
  formFieldLabel__passkeyName: "Pääsuvõtme nimi",
  formFieldLabel__password: "Parool",
  formFieldLabel__phoneNumber: "Telefoninumber",
  formFieldLabel__role: "Roll",
  formFieldLabel__signOutOfOtherSessions: "Logi teistest seadmetest välja",
  formFieldLabel__username: "Kasutajanimi",
  identityPreviewEditButton__emailAddress: "Muuda e-posti aadressi",
  identityPreviewEditButton__identifier: "Muuda tunnust",
  identityPreviewEditButton__phoneNumber: "Muuda telefoninumbrit",
  lastAuthenticationStrategy: "Viimati kasutatud",
  membershipRole__admin: "Haldur",
  membershipRole__basicMember: "Liige",
  membershipRole__guestMember: "Külaline",
  paginationButton__next: "Järgmine",
  paginationButton__previous: "Eelmine",
  paginationRowText__displaying: "Kuvatakse",
  paginationRowText__of: "/",
  searchInput: {
    action__clear: "Tühjenda otsing",
  },
  socialButtonsBlockButton: "Jätka teenusega {{provider|titleize}}",
  socialButtonsBlockButtonManyInView: "{{provider|titleize}}",
  createOrganization: {
    formButtonSubmit: "Loo töökoht",
    invitePage: {
      formButtonReset: "Jäta vahele",
    },
    title: "Loo töökoht",
  },
  organizationList: {
    action__createOrganization: "Loo töökoht",
    action__invitationAccept: "Liitu",
    action__suggestionsAccept: "Taotle liitumist",
    createOrganization: "Loo töökoht",
    invitationAcceptedLabel: "Liitutud",
    subtitle: "workhali jätkamiseks",
    suggestionsAcceptedLabel: "Ootab kinnitamist",
    title: "Vali konto",
    titleWithoutPersonal: "Vali töökoht",
  },
  organizationProfile: {
    createDomainPage: {
      subtitle:
        "Lisa kinnitatav domeen. Selle domeeni e-posti aadressiga kasutajad saavad töökohaga automaatselt liituda või liitumist taotleda.",
      title: "Lisa domeen",
    },
    invitePage: {
      detailsTitle__inviteFailed:
        "Kutseid ei saanud saata. Järgmistele aadressidele on kutse juba saadetud: {{email_addresses}}.",
      formButtonPrimary__continue: "Saada kutsed",
      formButtonPrimary__purchaseSeats: "Osta lisakohti",
      selectDropdown__role: "Vali roll",
      subtitle:
        "Sisesta või kleebi üks või mitu tühiku või komaga eraldatud e-posti aadressi.",
      successMessage: "Kutsed on saadetud",
      title: "Kutsu uusi liikmeid",
    },
    membersPage: {
      action__invite: "Kutsu",
      action__search: "Otsi",
      activeMembersTab: {
        menuAction__remove: "Eemalda liige",
        tableHeader__actions: "Toimingud",
        tableHeader__joined: "Liitus",
        tableHeader__role: "Roll",
        tableHeader__user: "Kasutaja",
      },
      detailsTitle__emptyRow: "Liikmeid pole",
      invitationsTab: {
        autoInvitations: {
          headerSubtitle:
            "Kutsu kasutajaid kinnitatud e-posti domeeni alusel. Sobiva domeeniga konto loonud kasutajad saavad töökohaga automaatselt liituda.",
          headerTitle: "Automaatsed kutsed",
          primaryButton: "Halda kinnitatud domeene",
        },
        table__emptyRow: "Kutseid pole",
      },
      invitedMembersTab: {
        menuAction__revoke: "Tühista kutse",
        tableHeader__invited: "Kutsutud",
      },
      requestsTab: {
        autoSuggestions: {
          headerSubtitle:
            "Sobiva e-posti domeeniga kasutajad näevad võimalust töökohaga liitumist taotleda.",
          headerTitle: "Automaatsed soovitused",
          primaryButton: "Halda kinnitatud domeene",
        },
        menuAction__approve: "Kinnita",
        menuAction__reject: "Lükka tagasi",
        tableHeader__requested: "Juurdepääsu taotlus",
        table__emptyRow: "Taotlusi pole",
      },
      start: {
        headerTitle__invitations: "Kutsed",
        headerTitle__members: "Liikmed",
        headerTitle__requests: "Taotlused",
      },
    },
    navbar: {
      apiKeys: "API-võtmed",
      billing: "Arveldamine",
      description: "Halda töökohta.",
      general: "Üldine",
      members: "Liikmed",
      security: "Turvalisus",
      title: "Töökoht",
    },
    profilePage: {
      dangerSection: {
        deleteOrganization: {
          actionDescription:
            "Jätkamiseks sisesta allpool „{{organizationName}}“.",
          messageLine1: "Kas soovid kindlasti selle töökoha kustutada?",
          messageLine2: "Seda toimingut ei saa tagasi võtta.",
          successMessage: "Töökoht on kustutatud.",
          title: "Kustuta töökoht",
        },
        leaveOrganization: {
          actionDescription:
            "Jätkamiseks sisesta allpool „{{organizationName}}“.",
          messageLine1:
            "Kas soovid kindlasti sellest töökohast lahkuda? Kaotad juurdepääsu töökohale ja selle teenustele.",
          messageLine2: "Seda toimingut ei saa tagasi võtta.",
          successMessage: "Oled töökohast lahkunud.",
          title: "Lahku töökohast",
        },
        title: "Ohtlikud toimingud",
      },
      domainSection: {
        menuAction__manage: "Halda",
        menuAction__remove: "Kustuta",
        menuAction__verify: "Kinnita",
        primaryButton: "Lisa domeen",
        subtitle:
          "Luba kasutajatel kinnitatud e-posti domeeni alusel töökohaga automaatselt liituda või liitumist taotleda.",
        title: "Kinnitatud domeenid",
      },
      successMessage: "Töökoht on uuendatud.",
      title: "Uuenda profiili",
    },
    removeDomainPage: {
      messageLine1: "E-posti domeen {{domain}} eemaldatakse.",
      messageLine2:
        "Pärast seda ei saa kasutajad enam automaatselt töökohaga liituda.",
      successMessage: "{{domain}} on eemaldatud.",
      title: "Eemalda domeen",
    },
    securityPage: {
      title: "Turvalisus",
    },
    start: {
      headerTitle__general: "Üldine",
      headerTitle__members: "Liikmed",
      membershipSeatUsageLabel: "{{count}}/{{limit}} kohta kasutusel",
      profileSection: {
        primaryButton: "Uuenda profiili",
        title: "Profiil",
        uploadAction__title: "Logo",
      },
    },
    verifyDomainPage: {
      formSubtitle: "Sisesta e-postile saadetud kinnituskood",
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "Domeen {{domainName}} tuleb e-posti teel kinnitada.",
      subtitleVerificationCodeScreen:
        "Aadressile {{emailAddress}} saadeti kinnituskood. Jätkamiseks sisesta kood.",
      title: "Kinnita domeen",
    },
  },
  organizationSwitcher: {
    action__closeOrganizationSwitcher: "Sulge töökoha valik",
    action__createOrganization: "Loo töökoht",
    action__invitationAccept: "Liitu",
    action__manageOrganization: "Halda",
    action__openOrganizationSwitcher: "Ava töökoha valik",
    action__suggestionsAccept: "Taotle liitumist",
    notSelected: "Töökohta pole valitud",
    personalWorkspace: "Isiklik konto",
    suggestionsAcceptedLabel: "Ootab kinnitamist",
  },
  signIn: {
    accountSwitcher: {
      action__addAccount: "Lisa konto",
      action__signOutAll: "Logi kõigilt kontodelt välja",
      subtitle: "Vali konto, millega soovid jätkata.",
      title: "Vali konto",
    },
    alternativeMethods: {
      actionLink: "Küsi abi",
      actionText: "Ükski neist ei sobi?",
      blockButton__backupCode: "Kasuta varukoodi",
      blockButton__emailCode: "Saada kood aadressile {{identifier}}",
      blockButton__emailLink: "Saada link aadressile {{identifier}}",
      blockButton__passkey: "Logi sisse pääsuvõtmega",
      blockButton__password: "Logi sisse parooliga",
      blockButton__phoneCode: "Saada SMS-kood numbrile {{identifier}}",
      blockButton__totp: "Kasuta autentimisrakendust",
      getHelp: {
        blockButton__emailSupport: "Kirjuta kasutajatoele",
        content:
          "Kui kontole sisselogimine ei õnnestu, kirjuta kasutajatoele. Aitame juurdepääsu võimalikult kiiresti taastada.",
        title: "Abi",
      },
      subtitle: "Sisselogimiseks saad kasutada mõnda muud viisi.",
      title: "Vali muu viis",
    },
    alternativePhoneCodeProvider: {
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli teenust {{provider}}",
    },
    backupCodeMfa: {
      subtitle:
        "Kasuta varukoodi, mille said kaheastmelise autentimise seadistamisel.",
      title: "Sisesta varukood",
    },
    emailCode: {
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli e-posti",
    },
    emailCodeMfa: {
      formTitle: "Kontrolli e-posti",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli e-posti",
    },
    emailLink: {
      clientMismatch: {
        subtitle:
          "Ava kinnituslink samas seadmes ja brauseris, kus sisselogimist alustasid.",
        title: "Kinnituslink ei kehti selles seadmes",
      },
      expired: {
        subtitle: "Jätkamiseks naase algsele vahelehele.",
        title: "Kinnituslink on aegunud",
      },
      failed: {
        subtitle: "Jätkamiseks naase algsele vahelehele.",
        title: "Kinnituslink ei kehti",
      },
      formSubtitle: "Kasuta e-postile saadetud kinnituslinki",
      formTitle: "Kinnituslink",
      loading: {
        subtitle: "Sind suunatakse kohe edasi",
        title: "Sisselogimine…",
      },
      resendButton: "Link ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli e-posti",
      unusedTab: {
        title: "Võid selle vahelehe sulgeda",
      },
      verified: {
        subtitle: "Sind suunatakse kohe edasi",
        title: "Sisselogimine õnnestus",
      },
      verifiedSwitchTab: {
        subtitle: "Jätkamiseks naase algsele vahelehele",
        subtitleNewTab: "Jätkamiseks naase äsja avatud vahelehele",
        titleNewTab: "Logisid sisse teisel vahelehel",
      },
    },
    emailLinkMfa: {
      formSubtitle: "Kasuta e-postile saadetud kinnituslinki",
      resendButton: "Link ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli e-posti",
    },
    enterpriseConnections: {
      subtitle: "Vali ettevõtte konto, millega soovid jätkata.",
      title: "Vali ettevõtte konto",
    },
    forgotPassword: {
      formTitle: "Parooli lähtestamise kood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "parooli lähtestamiseks",
      subtitle_email: "Sisesta esmalt e-postile saadetud kood",
      subtitle_phone: "Sisesta esmalt telefonile saadetud kood",
      title: "Lähtesta parool",
    },
    forgotPasswordAlternativeMethods: {
      blockButton__resetPassword: "Lähtesta parool",
      label__alternativeMethods: "Või logi sisse muul viisil",
      title: "Unustasid parooli?",
    },
    newDeviceVerificationNotice:
      "Logid sisse uuest seadmest. Konto kaitsmiseks palume su isiku kinnitada.",
    noAvailableMethods: {
      message:
        "Sisselogimist ei saa jätkata, sest ühtegi sobivat kinnitusviisi pole seadistatud.",
      subtitle: "Tekkis viga",
      title: "Sisselogimine ei õnnestu",
    },
    passkey: {
      subtitle:
        "Pääsuvõti kinnitab sinu isiku. Seade võib küsida sõrmejälge, näotuvastust või ekraanilukku.",
      title: "Kasuta pääsuvõtit",
    },
    password: {
      actionLink: "Kasuta muud viisi",
      subtitle: "Sisesta oma konto parool",
      title: "Sisesta parool",
    },
    passwordCompromised: {
      title: "Parool on lekkinud",
    },
    passwordPwned: {
      title: "Parool on lekkinud",
    },
    passwordUntrusted: {
      title: "Parool pole usaldusväärne",
    },
    phoneCode: {
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kontrolli telefoni",
    },
    phoneCodeMfa: {
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "Sisesta telefonile saadetud kinnituskood",
      title: "Kontrolli telefoni",
    },
    protectCheck: {
      loading: "Laadimine…",
      retryButton: "Proovi uuesti",
      subtitle: "Oota, kuni su taotlust kontrollime.",
      title: "Taotluse kontrollimine",
    },
    resetPassword: {
      formButtonPrimary: "Lähtesta parool",
      requiredMessage: "Turvalisuse huvides pead parooli lähtestama.",
      successMessage: "Parool on muudetud. Sind logitakse sisse, palun oota.",
      title: "Määra uus parool",
    },
    resetPasswordMfa: {
      detailsLabel: "Enne parooli lähtestamist peame sinu isiku kinnitama.",
    },
    start: {
      actionLink: "Loo konto",
      actionLink__join_waitlist: "Liitu ootenimekirjaga",
      actionLink__use_email: "Kasuta e-posti",
      actionLink__use_email_username: "Kasuta e-posti või kasutajanime",
      actionLink__use_passkey: "Kasuta pääsuvõtit",
      actionLink__use_phone: "Kasuta telefoni",
      actionLink__use_username: "Kasuta kasutajanime",
      actionText: "Konto puudub?",
      actionText__join_waitlist: "Soovid varajast juurdepääsu?",
      alternativePhoneCodeProvider: {
        actionLink: "Kasuta muud viisi",
        label: "Teenuse {{provider}} telefoninumber",
        subtitle:
          "Sisesta telefoninumber, et saada teenuse {{provider}} kaudu kinnituskood.",
        title: "Logi teenusega {{provider}} workhali sisse",
      },
      subtitle: "Tere tulemast tagasi! Jätkamiseks logi sisse.",
      title: "Logi workhali sisse",
      titleCombined: "Jätka workhalis",
    },
    totpMfa: {
      formTitle: "Kinnituskood",
      subtitle: "Sisesta autentimisrakenduse loodud kinnituskood",
      title: "Kaheastmeline kinnitamine",
    },
    web3Solana: {
      subtitle: "Vali sisselogimiseks rahakott",
      title: "Logi sisse Solanaga",
    },
  },
  signInEnterPasswordTitle: "Sisesta parool",
  signUp: {
    alternativePhoneCodeProvider: {
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "Sisesta teenuse {{provider}} kaudu saadetud kinnituskood",
      title: "Kinnita {{provider}}",
    },
    continue: {
      actionLink: "Logi sisse",
      actionText: "Konto on juba olemas?",
      subtitle: "Jätkamiseks täida puuduvad väljad.",
      title: "Täida puuduvad väljad",
    },
    emailCode: {
      formSubtitle: "Sisesta e-postile saadetud kinnituskood",
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "Sisesta e-postile saadetud kinnituskood",
      title: "Kinnita e-posti aadress",
    },
    emailLink: {
      clientMismatch: {
        subtitle:
          "Ava kinnituslink samas seadmes ja brauseris, kus konto loomist alustasid.",
        title: "Kinnituslink ei kehti selles seadmes",
      },
      formSubtitle: "Kasuta e-postile saadetud kinnituslinki",
      formTitle: "Kinnituslink",
      loading: {
        title: "Konto loomine…",
      },
      resendButton: "Link ei saabunud? Saada uuesti",
      subtitle: "workhali jätkamiseks",
      title: "Kinnita e-posti aadress",
      verified: {
        title: "Konto loomine õnnestus",
      },
      verifiedSwitchTab: {
        subtitle: "Jätkamiseks naase äsja avatud vahelehele",
        subtitleNewTab: "Jätkamiseks naase eelmisele vahelehele",
        title: "E-posti aadress on kinnitatud",
      },
    },
    enterpriseConnections: {
      subtitle: "Vali ettevõtte konto, millega soovid jätkata.",
      title: "Vali ettevõtte konto",
    },
    legalConsent: {
      checkbox: {
        label__onlyPrivacyPolicy:
          'Nõustun {{ privacyPolicyLink || link("privaatsuspõhimõtetega") }}',
        label__onlyTermsOfService:
          'Nõustun {{ termsOfServiceLink || link("kasutustingimustega") }}',
        label__termsOfServiceAndPrivacyPolicy:
          'Nõustun {{ termsOfServiceLink || link("kasutustingimustega") }} ja {{ privacyPolicyLink || link("privaatsuspõhimõtetega") }}',
      },
      continue: {
        subtitle: "Jätkamiseks loe tingimused läbi ja nõustu nendega",
        title: "Nõusolek",
      },
    },
    phoneCode: {
      formSubtitle: "Sisesta telefonile saadetud kinnituskood",
      formTitle: "Kinnituskood",
      resendButton: "Kood ei saabunud? Saada uuesti",
      subtitle: "Sisesta telefonile saadetud kinnituskood",
      title: "Kinnita telefoninumber",
    },
    protectCheck: {
      loading: "Laadimine…",
      retryButton: "Proovi uuesti",
      subtitle: "Oota, kuni su taotlust kontrollime.",
      title: "Taotluse kontrollimine",
    },
    restrictedAccess: {
      actionLink: "Logi sisse",
      actionText: "Konto on juba olemas?",
      blockButton__emailSupport: "Kirjuta kasutajatoele",
      blockButton__joinWaitlist: "Liitu ootenimekirjaga",
      subtitle:
        "Uute kontode loomine on praegu suletud. Kui sul peaks olema juurdepääs, võta ühendust kasutajatoega.",
      subtitleWaitlist:
        "Uute kontode loomine on praegu suletud. Liitu ootenimekirjaga, et avamisest esimesena teada saada.",
      title: "Juurdepääs on piiratud",
    },
    start: {
      actionLink: "Logi sisse",
      actionLink__use_email: "Kasuta e-posti",
      actionLink__use_phone: "Kasuta telefoni",
      actionText: "Konto on juba olemas?",
      alternativePhoneCodeProvider: {
        actionLink: "Kasuta muud viisi",
        label: "Teenuse {{provider}} telefoninumber",
        subtitle:
          "Sisesta telefoninumber, et saada teenuse {{provider}} kaudu kinnituskood.",
        title: "Loo teenusega {{provider}} workhali konto",
      },
      subtitle: "Tere tulemast! Alustamiseks täida väljad.",
      subtitleCombined: "Tere tulemast! Alustamiseks täida väljad.",
      title: "Loo workhali konto",
      titleCombined: "Loo workhali konto",
    },
    web3Solana: {
      subtitle: "Vali konto loomiseks rahakott",
      title: "Loo konto Solanaga",
    },
  },
  userButton: {
    action__addAccount: "Lisa konto",
    action__closeUserMenu: "Sulge kasutajamenüü",
    action__manageAccount: "Halda kontot",
    action__openUserMenu: "Ava kasutajamenüü",
    action__signOut: "Logi välja",
    action__signOutAll: "Logi kõigilt kontodelt välja",
    label__accountActions: "Kontotoimingud",
    label__activeSessions: "Aktiivsed seansid",
    label__userButtonPopover: "Kontopaneel",
  },
  userProfile: {
    backupCodePage: {
      actionLabel__copied: "Kopeeritud!",
      actionLabel__copy: "Kopeeri kõik",
      actionLabel__download: "Laadi alla .txt-fail",
      actionLabel__print: "Prindi",
      infoText1: "Sellel kontol lubatakse varukoodid.",
      infoText2:
        "Hoia varukoodid salajas ja turvalises kohas. Kui arvad, et koodid on lekkinud, saad luua uued.",
      subtitle__codelist: "Hoia neid turvalises kohas ja salajas.",
      successMessage:
        "Varukoodid on nüüd lubatud. Kui kaotad juurdepääsu autentimisseadmele, saad iga koodi ühe korra sisselogimiseks kasutada.",
      successSubtitle:
        "Kui kaotad juurdepääsu autentimisseadmele, saad neid sisselogimiseks kasutada.",
      title: "Lisa varukoodiga kinnitamine",
      title__codelist: "Varukoodid",
    },
    connectedAccountPage: {
      formHint: "Vali teenus, mille konto soovid ühendada.",
      formHint__noAccounts: "Ühendamiseks sobivaid teenuseid pole.",
      removeResource: {
        messageLine1: "{{identifier}} eemaldatakse sellelt kontolt.",
        messageLine2:
          "Seda ühendatud kontot ja sellest sõltuvaid funktsioone ei saa enam kasutada.",
        successMessage: "{{connectedAccount}} eemaldati sinu kontolt.",
        title: "Eemalda ühendatud konto",
      },
      socialButtonsBlockButton: "{{provider|titleize}}",
      successMessage: "Teenus lisati sinu kontole",
      title: "Lisa ühendatud konto",
    },
    deletePage: {
      actionDescription: "Jätkamiseks sisesta allpool „Kustuta konto“.",
      confirm: "Kustuta konto",
      messageLine1:
        "Kas soovid kindlasti oma konto kustutada? Osa seotud andmeid võidakse säilitada. Kõigi andmete kustutamiseks võta ühendust kasutajatoega.",
      messageLine2: "Seda toimingut ei saa tagasi võtta.",
      title: "Kustuta konto",
    },
    emailAddressPage: {
      emailCode: {
        formHint: "Sellele aadressile saadetakse kinnituskood.",
        formSubtitle: "Sisesta aadressile {{identifier}} saadetud kood",
        formTitle: "Kinnituskood",
        resendButton: "Kood ei saabunud? Saada uuesti",
        successMessage: "Aadress {{identifier}} lisati sinu kontole.",
      },
      emailLink: {
        formHint: "Sellele aadressile saadetakse kinnituslink.",
        formSubtitle:
          "Ava aadressile {{identifier}} saadetud kirjas olev kinnituslink",
        formTitle: "Kinnituslink",
        resendButton: "Link ei saabunud? Saada uuesti",
        successMessage: "Aadress {{identifier}} lisati sinu kontole.",
      },
      enterpriseSSOLink: {
        formButton: "Logi sisse",
        formSubtitle: "Lõpeta sisselogimine kontoga {{identifier}}",
      },
      formHint: "Enne lisamist pead selle e-posti aadressi kinnitama.",
      removeResource: {
        messageLine1: "{{identifier}} eemaldatakse sellelt kontolt.",
        messageLine2: "Selle e-posti aadressiga ei saa enam sisse logida.",
        successMessage: "{{emailAddress}} eemaldati sinu kontolt.",
        title: "Eemalda e-posti aadress",
      },
      title: "Lisa e-posti aadress",
      verifyTitle: "Kinnita e-posti aadress",
    },
    formButtonPrimary__add: "Lisa",
    formButtonPrimary__continue: "Jätka",
    formButtonPrimary__finish: "Lõpeta",
    formButtonPrimary__remove: "Eemalda",
    formButtonPrimary__save: "Salvesta",
    formButtonReset: "Tühista",
    mfaPage: {
      formHint: "Vali lisatav viis.",
      title: "Lisa kaheastmeline kinnitamine",
    },
    mobileButton__menu: "Menüü",
    navbar: {
      account: "Profiil",
      apiKeys: "API-võtmed",
      billing: "Arveldamine",
      description: "Halda oma konto andmeid.",
      security: "Turvalisus",
      title: "Konto",
    },
    passwordPage: {
      checkboxInfoText__signOutOfOtherSessions:
        "Soovitame logida välja kõigist teistest seadmetest, kus võidi vana parooli kasutada.",
      readonly:
        "Parooli ei saa praegu muuta, sest saad sisse logida ainult ettevõtte ühenduse kaudu.",
      successMessage__set: "Parool on määratud.",
      successMessage__signOutOfOtherSessions:
        "Kõigist teistest seadmetest logiti välja.",
      successMessage__update: "Parool on uuendatud.",
      title__set: "Määra parool",
      title__update: "Uuenda parooli",
    },
    phoneNumberPage: {
      infoText:
        "Sellele numbrile saadetakse kinnituskoodiga SMS. Rakenduda võivad sõnumi- ja andmesidetasud.",
      removeResource: {
        messageLine1: "{{identifier}} eemaldatakse sellelt kontolt.",
        messageLine2: "Selle telefoninumbriga ei saa enam sisse logida.",
        successMessage: "{{phoneNumber}} eemaldati sinu kontolt.",
        title: "Eemalda telefoninumber",
      },
      successMessage: "{{identifier}} lisati sinu kontole.",
      title: "Lisa telefoninumber",
      verifySubtitle: "Sisesta numbrile {{identifier}} saadetud kinnituskood",
      verifyTitle: "Kinnita telefoninumber",
    },
    profilePage: {
      fileDropAreaHint: "Soovitatav kuvasuhe 1:1, kuni 10 MB.",
      imageFormDestructiveActionSubtitle: "Eemalda",
      imageFormSubtitle: "Laadi üles",
      imageFormTitle: "Profiilipilt",
      readonly:
        "Sinu profiiliandmed pärinevad ettevõtte ühendusest ja neid ei saa muuta.",
      successMessage: "Profiil on uuendatud.",
      title: "Uuenda profiili",
    },
    start: {
      activeDevicesSection: {
        destructiveAction: "Logi seadmest välja",
        title: "Aktiivsed seadmed",
      },
      connectedAccountsSection: {
        actionLabel__connectionFailed: "Ühenda uuesti",
        actionLabel__reauthorize: "Anna uuesti luba",
        destructiveActionTitle: "Eemalda",
        primaryButton: "Ühenda konto",
        subtitle__disconnected: "See konto on lahti ühendatud.",
        subtitle__reauthorize:
          "Nõutud õigused on muutunud. Probleemide vältimiseks anna sellele teenusele uuesti luba.",
        title: "Ühendatud kontod",
      },
      dangerSection: {
        deleteAccountButton: "Kustuta konto",
        title: "Konto kustutamine",
      },
      emailAddressesSection: {
        destructiveAction: "Eemalda e-posti aadress",
        detailsAction__nonPrimary: "Määra peamiseks",
        detailsAction__primary: "Lõpeta kinnitamine",
        detailsAction__unverified: "Kinnita",
        primaryButton: "Lisa e-posti aadress",
        title: "E-posti aadressid",
      },
      enterpriseAccountsSection: {
        primaryButton: "Ühenda konto",
        title: "Ettevõtte kontod",
      },
      headerTitle__account: "Profiiliandmed",
      headerTitle__security: "Turvalisus",
      mfaSection: {
        backupCodes: {
          actionLabel__regenerate: "Loo uued",
          headerTitle: "Varukoodid",
          subtitle__regenerate:
            "Loo uued turvalised varukoodid. Eelmised koodid kustutatakse ja neid ei saa enam kasutada.",
          title__regenerate: "Loo uued varukoodid",
        },
        phoneCode: {
          actionLabel__setDefault: "Määra vaikimisi",
          destructiveActionLabel: "Eemalda",
        },
        primaryButton: "Lisa kaheastmeline kinnitamine",
        title: "Kaheastmeline kinnitamine",
        totp: {
          destructiveActionTitle: "Eemalda",
          headerTitle: "Autentimisrakendus",
        },
      },
      passkeysSection: {
        menuAction__destructive: "Eemalda",
        menuAction__rename: "Nimeta ümber",
        primaryButton: "Lisa pääsuvõti",
        title: "Pääsuvõtmed",
      },
      passwordSection: {
        primaryButton__setPassword: "Määra parool",
        primaryButton__updatePassword: "Uuenda parooli",
        title: "Parool",
      },
      phoneNumbersSection: {
        destructiveAction: "Eemalda telefoninumber",
        detailsAction__nonPrimary: "Määra peamiseks",
        detailsAction__primary: "Lõpeta kinnitamine",
        detailsAction__unverified: "Kinnita telefoninumber",
        primaryButton: "Lisa telefoninumber",
        title: "Telefoninumbrid",
      },
      profileSection: {
        primaryButton: "Uuenda profiili",
        title: "Profiil",
      },
      usernameSection: {
        primaryButton__setUsername: "Määra kasutajanimi",
        primaryButton__updateUsername: "Uuenda kasutajanime",
        title: "Kasutajanimi",
      },
    },
    usernamePage: {
      successMessage: "Kasutajanimi on uuendatud.",
      title__set: "Määra kasutajanimi",
      title__update: "Uuenda kasutajanime",
    },
  },
} satisfies ClerkLocalization

export const clerkLocalizationByLocale = {
  en: undefined,
  et: etEE,
} satisfies Record<Locale, ClerkLocalization | undefined>
