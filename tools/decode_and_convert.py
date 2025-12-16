import sys
import subprocess

# Your field name mappings
mapping = {
    '155': 'vsSeekerScheduleSettings',
    'naijfflnbfb': 'combatLeague',
    'poijigbinjg': 'title',
    'pjalicafdng': 'enabled',
    'loellmkmmhg': 'pokemonCondition',
    'jbmedkmdfil': 'unlockCondition',
    'djdfkjkepnh': 'maxCp',
    'aalfkgcpihl': 'minCp',
    'ahpdkpaikfh': 'minPokemonCount',
    'dggajfchbde': 'iconUrl',
    'ihkkjcabbkp': 'pokemonCount',
    'bkmkafhgkcj': 'bannedPokemon',
    'djfflfljoai': 'badgeType',
    'lcpmfapjkio': 'leagueType',
    'nfcpinfjacc': 'allowTempEvos',
    'eldkgbekbcd': 'battlePartyCombatLeagueTemplateId',
    'fpdejmjpbda': 'afterTimestamp',
    'alpmadkbgng': 'beforeTimestamp',
    'olgjoehgbbb': 'id',
    'bmopheeeicj': 'form',
    'fcbnommfmpi': 'uniqueId',
    'mbhdhjbplpb': 'power',
    'kcninjhopcm': 'vfxName',
    'fcblhjljefd': 'energyDelta',
    'eicmgmmclpd': 'targetDefenseStatStageChange',
    'gpofigbenno': 'buffActivationChance',
    'jnifhhckmch': 'animationId',
    'ekcfmgfcbkm': 'accuracyChance',
    'lchdbepbohl': 'criticalChance',
    'dnemhkmodpj': 'staminaLossScalar',
    'hmeeahppgfe': 'trainerLevelMin',
    'jmfbhnkedeh': 'trainerLevelMax',
    'jncpmilfkbb': 'durationMs',
    'jnjbgjgbjnk': 'damageWindowStartMs',
    'llplmnhgnpa': 'damageWindowEndMs',
    'agjaaeijknd': 'modelScale',
    'hlepooiialf': 'type',
    'bmplhpimedk': 'type2',
    'dnkaffhdgbk': 'diskRadiusM',
    'odilepepipb': 'cylinderRadiusM',
    'pgbdkgmepch': 'cylinderHeightM',
    'pphagfeceph': 'shoulderModeScale',
    'imndebjadhe': 'collisionRadiusM',
    'kfdljdpagkn': 'collisionHeightM',
    'lkpakmffofp': 'collisionHeadRadiusM',
    'emcjgehjlia': 'movementType',
    'dhleehalcdd': 'movementTimerS',
    'cpfggbncdbn': 'jumpTimeS',
    'agijaeigioa': 'attackTimerS',
    'bpnfjbifdmp': 'attackProbability',
    'bcihgjfcoih': 'dodgeProbability',
    'eglpdahlabf': 'dodgeDurationS',
    'cbfokeapibh': 'dodgeDistance',
    'ekkgckgpbgl': 'cameraDistance',
    'ljagnhidaem': 'minPokemonActionFrequencyS',
    'dhdhkhfmfkb': 'maxPokemonActionFrequencyS',
    'fkgnpdcglna': 'shadowBaseCaptureRate',
    'nmnnifnieno': 'shadowAttackProbability',
    'hgoljagahkh': 'shadowDodgeProbability',
    'daldkmiicjj': 'baseStamina',
    'jnhiafjbmgd': 'baseAttack',
    'aakhmhpknjn': 'baseDefense',
    'dhdhmmmkjcd': 'quickMoves',
    'fclhcmaklie': 'cinematicMoves',
    'ckccocidjga': 'animationTime',
    'acigbjifjcp': 'evolution',
    'jikgookjgpi': 'evolutionPips',
    'iepohokddac': 'pokedexHeightM',
    'hfmdecbndff': 'pokedexWeightKg',
    'bcbhbblkhme': 'heightStdDev',
    'cbfmijpanfc': 'weightStdDev',
    'lcolkilojpi': 'familyId',
    'eginlpkhlnm': 'candyToEvolve',
    'fmikkjlicml': 'kmBuddyDistance',
    'elfhmnejmod': 'modelHeight',
    'iodphcgglhk': 'candyCost',
    'pefghmholld': 'candyCostPurified',
    'bhfnhmhoach': 'modelScaleV2',
    'ldjplckhikb': 'buddyOffsetMale',
    'anjppheibno': 'buddyOffsetFemale',
    'ppillmkgadk': 'buddyScale',
    'ocpfplpmmff': 'stardustToUnlock',
    'elecheofdki': 'candyToUnlock',
    'daldnimbmjk': 'isTransferable',
    'lidfalnpebd': 'isDeployable',
    'ffabckabhac': 'isTradable',
    'pgfkljfgmnd': 'purificationStardustNeeded',
    'ipphbfbbknj': 'purificationCandyNeeded',
    'lkdebagnclk': 'purifiedChargeMove',
    'iimcaelhdje': 'shadowChargeMove',
    'mhkjbpoajke': 'buddyGroupNumber',
    'gojoephldpf': 'buddyWalkedMegaEnergyAward',
}

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python decode_and_convert.py <v2_GAME_MASTER_file>")
        print("Example: python decode_and_convert.py v2_GAME_MASTER")
        sys.exit(1)
    
    input_file = sys.argv[1]
    
    print("=" * 60)
    print("POKEMON GO GAME MASTER DECODER")
    print("=" * 60)
    
    # Step 1: Decode binary protobuf to text
    print("\nStep 1: Decoding binary Game Master file...")
    cmd = [
        r'C:\protoc\bin\protoc.exe',
        '--decode=POGOProtos.Rpc.DownloadGmTemplatesResponseProto',
        '--proto_path=C:\\Users\\brada\\POGOProtos\\out\\single_file\\proto',
        'C:\\Users\\brada\\POGOProtos\\out\\single_file\\proto\\POGOProtos.Rpc.proto'
    ]
    
    with open(input_file, 'rb') as f:
        result = subprocess.run(cmd, stdin=f, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"ERROR: Decoding failed!")
        print(result.stderr)
        sys.exit(1)
    
    decoded_content = result.stdout
    print("✓ Decoded successfully")
    
    # Step 2: Replace obfuscated field names
    print("\nStep 2: Cleaning obfuscated field names...")
    cleaned_content = decoded_content
    replacements = 0
    
    for obfuscated, clean in mapping.items():
        # Replace field assignments
        if obfuscated + ':' in cleaned_content:
            cleaned_content = cleaned_content.replace(obfuscated + ':', clean + ':')
            replacements += 1
        # Replace message types
        if obfuscated + ' {' in cleaned_content:
            cleaned_content = cleaned_content.replace(obfuscated + ' {', clean + ' {')
            replacements += 1
    
    print(f"✓ Replaced {replacements} obfuscated field names")
    
    # Step 3: Save output
    output_file = 'game_master_final.txt'
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(cleaned_content)
    
    print(f"\n✓ Complete! Saved to: {output_file}")
    print("\n" + "=" * 60)
    print("You can now parse this file in your scraper.")
    print("=" * 60)

    # call with: "python decode_and_convert.py v2_GAME_MASTER"