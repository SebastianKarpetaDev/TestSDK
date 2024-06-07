#!/usr/bin/env perl

# Intall the prerequitites, run cpan and then run the following:
# insta LWP::Simple
# insta LWP::Protocol::https

use strict;
use warnings;
use LWP::Simple;

my $url = 'https://vpn.karpeta.org/new/index.php';
my $format = "simple";
#my $format = "tsv";

print "Fetching $url\n";
my $content_line = get($url);
unless (defined($content_line)) {die "Could not get $url\n$!\n"}
my @content_array = split chr(10), $content_line;
undef $content_line;

my %handles;

my $ext;

if ($format eq "simple") {$ext = ".txt";} else {$ext = ".tsv";};

my %filenames;
$filenames{"sdk"} = "sdk$ext";
$filenames{"fp"} = "fp$ext";
$filenames{"s"} = "fixed$ext";

foreach my $value (values %filenames) {
  print "Saving to $value\n";
}


open(my $handle_sdk, '>', $filenames{"sdk"}) or die $!;
open(my $handle_fp, '>', $filenames{"fp"}) or die $!;
open(my $handle_s, '>', $filenames{"s"}) or die $!;
$handles{"sdk"} = $handle_sdk;
$handles{"fp"} = $handle_fp;
$handles{"s"} = $handle_s;

foreach (@content_array)
{
  s/^\s+|\s+$//g;
  if (/<tr class="\s*(sdk|fp|s)\s*"><td>(\d+)<\/td><td>([a-zA-Z.]+)<\/td><td>([a-zA-Z ]+)<\/td><td>([a-zA-Z ]*)<\/td><td>([a-zA-Z ]+)<\/td><td><\/td><td>([a-zA-Z]+)<\/td><td>([a-zA-Z.]+)<\/td>/)
  {
	my $line_full;
        my $handle = $handles{$1};
        my @array2;

        if ($format eq "simple")
        {
          my @array = ($3, $4, $5, $6);
          my $line_short = "";
          foreach (@array)
          {
            s/^\s+|\s+$//g;
            if (length($_)>0)
            {
              push @array2, $_;
            }
          }
          $line_full = join(", ", @array2)."\n";
        } else
        {
          $line_full = "$1\t$2\t$3\t$4\t$5\t$6\t$7\t$8\n";
        }
	print $handle $line_full;
  }
}

foreach my $value (values %handles) {
  close($value);
}

print "Complete\n"
